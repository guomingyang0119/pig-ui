<template>
	<main class="quotation-page" v-loading="busy">
		<template v-if="!quote">
			<header class="q-header">
				<div>
					<h1>报价工作台</h1>
					<p class="q-subtitle">导入客户清单，逐行识别材料与设备，匹配规则计算并汇总报价。</p>
				</div>
				<div class="q-toolbar" v-if="canEdit">
					<el-button @click="productRuleDialog?.open()">产品规则管理</el-button>
					<el-button @click="createBlank()">新建报价</el-button>
					<el-button @click="aiImportDialog?.open()">AI整理资料并建草稿</el-button>
					<el-button type="primary" @click="importDialog?.open()">导入客户清单</el-button>
				</div>
			</header>
			<el-alert
				v-if="!activeCatalog && !activeEquipment && !failed"
				title="尚无可用的供货指标，请负责人按清单涉及的材料或设备，到指标管理核对并发布。"
				type="warning"
				:closable="false"
				show-icon
			/>
			<el-alert v-if="failed" title="报价模块加载失败，请确认业务表、账号权限和服务已就绪。" type="error" :closable="false">
				<el-button text @click="initialize">重新加载</el-button>
			</el-alert>
			<div class="q-flow">
				<span><b>01</b>导入清单，自动逐行识别</span><span><b>02</b>匹配规则，核对待确认项</span><span><b>03</b>计算每行报价，汇总整单</span>
			</div>
			<QuoteList />
		</template>
		<template v-else>
			<header class="q-header">
				<div>
					<div class="q-title">
						<el-button text @click="back">← 返回</el-button>
						<h1>{{ quote.body.project || '新建报价' }}</h1>
						<el-tag effect="plain" :type="quote.state === 'final' ? 'success' : 'info'">{{ stateLabels[quote.state] }} · V{{ quote.version }}</el-tag>
					</div>
					<p class="q-subtitle">
						编号 {{ quote.family.slice(0, 8).toUpperCase() }} · {{ quote.body.source_filename || '手工清单' }} · 整单报价 ·
						{{ isAuto ? '自动识别清单' : '历史清单' }}<span v-if="dirty"> · 有未保存修改</span>
					</p>
				</div>
				<div class="q-toolbar">
					<el-button v-if="canEdit && quote.state !== 'archived'" @click="revise">创建修订版</el-button>
					<el-button v-if="quote.body.ai_review_status" @click="downloadStandard">下载待核验报价单</el-button>
					<el-button v-if="!locked && quote.body.ai_review_status" @click="chooseAiInputFile">导回已校验清单</el-button>
					<el-button v-if="!locked && aiReviewPending" type="warning" @click="approveAi">人工核验完成</el-button>
					<el-button v-if="!locked" @click="save(false)" :loading="saving">保存草稿</el-button>
					<el-button v-if="!locked" type="primary" :disabled="aiReviewPending" @click="save(true)" :loading="saving">保存并试算</el-button>
				</div>
			</header>
			<el-alert
				v-if="aiReviewPending"
				type="warning"
				:closable="false"
				show-icon
				:title="`AI已按正式报价样式生成待核验草稿。${
					aiUnknownNameCount ? `有 ${aiUnknownNameCount} 行产品名称待识别。` : ''
				}请对照客户资料逐行核验；可以在页面修改后保存，也可以下载Excel校验后“导回已校验清单”，再点击“人工核验完成”；确认前不能试算。`"
			/>
			<div v-if="quote.body.ai_source_files?.length" class="q-toolbar" style="margin: 12px 0">
				<span>客户原始资料：</span>
				<el-button v-for="(name, index) in quote.body.ai_source_files" :key="index" link type="primary" @click="downloadAiSource(index, name)">{{
					name
				}}</el-button>
			</div>
			<el-alert
				v-if="quote.state !== 'draft'"
				type="info"
				:closable="false"
				show-icon
				title="此版本已锁定。查看或下载历史文件；修改内容请先创建修订版。"
			/>
			<el-alert
				v-if="quote.result_stale && quote.body.include_freight != null"
				type="warning"
				:closable="false"
				title="运算规则已更新，当前结果不能继续导出，请重新保存并试算。"
			/>
			<el-alert v-if="isAuto && hasDuctRows && !activeCatalog" type="warning" :closable="false" title="清单含风管，需先核对并发布风管指标。" />
			<section class="q-section">
				<el-form label-position="top" :disabled="locked" class="q-grid" @submit.prevent>
					<el-form-item label="客户名称"><el-input v-model="quote.body.customer" placeholder="填写客户名称" /></el-form-item>
					<el-form-item label="项目名称"><el-input v-model="quote.body.project" placeholder="填写工程项目" /></el-form-item>
					<el-form-item label="联系人 / 电话"><el-input v-model="quote.body.contact" /></el-form-item>
					<el-form-item label="报价日期"><el-date-picker v-model="quote.body.quote_date" value-format="YYYY-MM-DD" type="date" /></el-form-item>
					<el-form-item label="送货地点" style="grid-column: span 2"><el-input v-model="quote.body.delivery_location" /></el-form-item>
					<el-form-item label="报价备注（会进入客户文件）" style="grid-column: span 2"
						><el-input v-model="quote.body.note" type="textarea" :rows="1" maxlength="1000"
					/></el-form-item>
				</el-form>
			</section>
			<section class="q-section">
				<h2 style="margin-bottom: 16px">整单供货条件</h2>
				<el-alert
					v-if="quote.body.include_freight == null"
					:title="
						quote.state === 'draft' ? '原运费设置未统一，请选择整单是否含运费后重新试算。' : '此历史版本沿用原分项运费设置；调整请先创建修订版。'
					"
					type="warning"
					:closable="false"
				/>
				<el-alert
					v-if="isEquipment && !activeEquipment && (!isAuto || hasEquipmentRows)"
					title="尚无唯一生效的设备指标，请负责人到指标管理的设备指标中核对并发布。"
					type="warning"
					:closable="false"
				/>
				<el-form :disabled="locked" label-position="top" class="q-grid" style="margin-top: 14px" @submit.prevent>
					<el-form-item label="报价含税口径 · 必选"
						><el-select v-model="orderOptions.tax_included" placeholder="请明确选择" @change="syncEquipment">
							<el-option :value="false" label="不含税" /><el-option :value="true" label="含税" /></el-select
					></el-form-item>
					<el-form-item label="整单付款方式 · 必选"
						><el-select v-model="orderOptions.payment_option" placeholder="请选择" @change="syncEquipment">
							<el-option
								v-for="term in orderPaymentTerms"
								:key="term.code"
								:value="term.code"
								:label="term.label + ' × ' + term.coefficient" /></el-select
					></el-form-item>
					<el-form-item label="整单是否含运费"
						><el-select v-model="quote.body.include_freight" placeholder="请选择整单运费口径" @change="freightChanged">
							<el-option :value="false" label="不含运费" /><el-option :value="true" label="含运费" /></el-select
					></el-form-item>
					<el-form-item v-if="quote.body.include_freight && quote.body.equipment_options && (!isAuto || hasEquipmentRows)" label="送货省区"
						><el-select v-model="quote.body.equipment_options.region" clearable placeholder="含运费时必选">
							<el-option
								v-for="region in ['贵州', '四川', '广西', '云南', '陕西', '海南']"
								:key="region"
								:value="region"
								:label="region" /></el-select
					></el-form-item>
					<el-form-item
						v-if="quote.body.include_freight && quote.body.equipment_options && (!isAuto || hasEquipmentRows)"
						label="整单设备运费（整单试算销售额低于 8000 元时填写）"
					>
						<el-input v-model="quote.body.equipment_options.freight_amount" placeholder="可填 0；整单试算销售额达到 8000 元时无需填写" />
					</el-form-item>
				</el-form>
				<p class="q-muted">
					运费选择对整张清单生效。风管运费仍按原规则计入材料单价；设备按“原单台售价 ×
					地区运费系数”计算含运费单价。付款系数在产品行、另列运费和安装费合计后统一应用。
				</p>
				<p v-if="quote.body.include_freight && isEquipment && (!isAuto || hasEquipmentRows)" class="q-muted">
					系统先汇总风管、设备、试算设备运费和安装费，再应用付款系数。整单试算销售额达到 8000 元时，设备运费计入每台设备售价；低于 8000
					元时，填写一次整单设备运费并单独列示，明确填 0 有效。
				</p>
			</section>
			<el-collapse v-if="quote.body.pricing_mode !== 'equipment_v1' && (!isAuto || hasDuctRows)" v-model="sections">
				<el-collapse-item name="conditions" :title="isAuto ? '风管默认计价条件' : '整单计价条件'">
					<p class="q-muted" style="margin: 4px 0 14px">下面是整单默认值。清单某行已明确的成品状态、管件类型和法兰形式优先。</p>
					<el-form :disabled="locked" label-position="top" class="q-grid" @submit.prevent>
						<el-form-item label="面积结算口径 · 必选"
							><el-select v-model="options.area_basis" placeholder="请选择"
								><el-option label="开板面积" value="open" /><el-option label="净面积" value="net" /></el-select
						></el-form-item>
						<el-form-item label="成品状态 · 必选"
							><el-select v-model="options.product_state" placeholder="请选择" @change="stateChanged"
								><el-option v-for="[value, label] in productStates" :key="value" :value="value" :label="label" /></el-select
						></el-form-item>
						<el-form-item label="管件类型"
							><el-select v-model="options.shape" placeholder="请选择"
								><el-option v-for="[value, label] in shapes" :key="value" :value="value" :label="label" /></el-select
						></el-form-item>
						<el-form-item label="法兰形式 · 必选"
							><el-select v-model="options.flange" placeholder="请选择"
								><el-option v-for="[value, label] in flangeTypes" :key="value" :value="value" :label="label" /><el-option
									value="mixed"
									label="混合法兰（按清单逐行）" /></el-select
						></el-form-item>
						<el-form-item label="镀锌层"
							><el-select v-model="options.zinc_layer"><el-option value="40" label="40g（贵州默认）" /><el-option value="80" label="80g" /></el-select
						></el-form-item>
						<el-form-item label="共板法兰打孔 · 有共板时必选"
							><el-select v-model="options.include_common_punch" placeholder="请明确选择"
								><el-option :value="false" label="不需要打孔" /><el-option :value="true" label="需要打孔" /></el-select
						></el-form-item>
					</el-form>
					<details>
						<summary style="cursor: pointer; padding: 10px 0">整单实际配件数量 / 角钢米数（客户有提供时填写）</summary>
						<el-form :disabled="locked" label-position="top" class="q-grid" style="margin-top: 10px" @submit.prevent>
							<el-form-item label="共板角码数量（个）"><el-input v-model="options.corner_count" placeholder="未提供则留空" /></el-form-item>
							<el-form-item label="共板卡扣长度（米）"><el-input v-model="options.clip_meters" placeholder="未提供则留空" /></el-form-item>
							<el-form-item label="整单 30# 角钢实际米数"><el-input v-model="options.flange_30_meters" placeholder="未提供则留空" /></el-form-item>
							<el-form-item label="整单 40# 角钢实际米数"><el-input v-model="options.flange_40_meters" placeholder="未提供则留空" /></el-form-item>
						</el-form>
						<p class="q-muted">整单角钢米数与本行角钢米数不能同时填写。共板半成品配件两项都留空时按面积取费；填写后仅按实际填写项计费。</p>
					</details>
				</el-collapse-item>
			</el-collapse>
			<InstallationPanel
				:body="quote.body"
				:locked="locked"
				:catalog="activeInstallation"
				:fee="quote.result?.fees.installation"
				:product-pending-count="quote.result?.pending_count || 0"
				@included-change="installationChanged"
			/>
			<section class="q-section">
				<div class="q-section-head">
					<div>
						<h2>
							产品报价明细 <span class="q-muted"> / {{ quote.body.rows.length }} 项</span>
						</h2>
						<p v-if="isAuto" class="q-muted">{{ recognitionSummary }}；未识别或缺少价格、规格的行需核对后才能生成正式报价。</p>
						<p class="q-muted">
							{{
								isEquipment
									? '逐行显示材料计算状态和金额；风管填写总面积，设备填写数量和单位。'
									: '逐行显示风管材料计算状态和金额；工程量按总面积填写。'
							}}
						</p>
					</div>
					<div v-if="!locked" class="q-toolbar">
						<el-button @click="productRuleDialog?.open()">产品规则管理</el-button>
						<el-button @click="autoClassify">重新识别清单</el-button>
						<el-button @click="addRow">＋ 添加项目</el-button>
					</div>
				</div>
				<el-table :data="quote.body.rows" class="q-table" max-height="450" :row-class-name="rowClass" @row-dblclick="openRow">
					<el-table-column type="index" label="#" width="48" />
					<el-table-column label="产品名称" min-width="170"
						><template #default="{ row }"><el-input v-model="row.name" :disabled="locked" placeholder="产品名称" /></template
					></el-table-column>
					<el-table-column label="规格描述" min-width="155"
						><template #default="{ row }"
							><el-input
								v-model="row.spec"
								:disabled="locked"
								:placeholder="[row.attributes.thickness, row.attributes.model].filter(Boolean).join(' / ') || '厚度 / 尺寸'" /></template
					></el-table-column>
					<el-table-column v-if="isEquipment" label="识别类别" width="135"
						><template #default="{ row }">
							<el-select v-model="row.category" :disabled="locked" clearable placeholder="待识别"
								><el-option
									v-for="category in [...equipmentCategories, '组合产品', '自定义产品']"
									:key="category"
									:value="category"
									:label="category"
							/></el-select> </template
					></el-table-column>
					<el-table-column :label="isEquipment ? '工程量 / 数量' : '工程量（㎡）'" width="140"
						><template #default="{ row }"
							><el-input
								v-if="!isEquipment || (quote.body.pricing_mode === 'mixed_v1' && row.category === '风管')"
								v-model="row.engineering_quantity"
								:disabled="locked"
								placeholder="总面积（㎡）"
								inputmode="decimal" />
							<el-input v-else v-model="row.quantity" :disabled="locked" placeholder="设备数量" inputmode="decimal" /></template
					></el-table-column>
					<el-table-column v-if="isEquipment" label="单位" width="90"
						><template #default="{ row }"><el-input v-model="row.unit" :disabled="locked" /></template
					></el-table-column>
					<el-table-column label="材料计算 / 状态" min-width="280"
						><template #default="{ $index }"
							><div class="material-status-cell">
								<template v-if="dirty">
									<el-tag type="warning" effect="light" size="small">修改后待计算</el-tag>
									<span>保存并计算后刷新本行结果</span>
								</template>
								<template v-else-if="quote.result?.rows[$index]?.status === 'priced'">
									<el-tag type="success" effect="light" size="small">已计算</el-tag>
									<span>{{ materialSummary($index) }}</span>
									<small v-if="materialExtraSummary($index)">{{ materialExtraSummary($index) }}</small>
								</template>
								<template v-else-if="quote.result?.rows[$index]?.status === 'pending'">
									<el-tag type="danger" effect="dark" size="small">待确认</el-tag>
									<span class="q-error">{{ quote.result?.rows[$index]?.reason }}</span>
								</template>
								<template v-else-if="quote.result?.rows[$index]?.status === 'excluded'">
									<el-tag type="info" effect="plain" size="small">不计价</el-tag>
									<span>{{ quote.result?.rows[$index]?.reason }}</span>
								</template>
								<template v-else>
									<el-tag type="info" effect="plain" size="small">未计算</el-tag>
									<span>保存并计算后查看结果</span>
								</template>
							</div></template
						></el-table-column
					>
					<el-table-column label="材料金额" width="130" align="right"
						><template #default="{ $index }"
							><span v-if="dirty" class="q-muted">—</span
							><span v-else-if="quote.result?.rows[$index]?.status === 'priced'" class="q-number">{{
								money(quote.result?.rows[$index]?.amount, rowDigits($index))
							}}</span
							><el-tag v-else-if="quote.result?.rows[$index]?.status === 'pending'" type="danger" effect="dark" size="small">待确认</el-tag
							><span v-else-if="quote.result?.rows[$index]?.status === 'excluded'" class="q-muted">不计价</span
							><span v-else class="q-muted">—</span></template
						></el-table-column
					>
					<el-table-column v-if="quote.body.installation_options?.included" label="安装费用" width="130" align="right">
						<template #default="{ $index }">
							<span v-if="dirty" class="q-muted">—</span>
							<el-tag v-else-if="quote.result?.rows[$index]?.installation_status === 'pending'" type="danger" effect="dark" size="small"
								>待确认</el-tag
							>
							<span v-else-if="quote.result?.rows[$index]?.installation_status === 'excluded'" class="q-muted">不含安装</span>
							<span v-else class="q-number">{{ money(quote.result?.rows[$index]?.installation_amount, 2) }}</span>
						</template>
					</el-table-column>
					<el-table-column v-if="quote.body.installation_options?.included" label="本行报价" width="130" align="right">
						<template #default="{ $index }">
							<span v-if="dirty" class="q-muted">—</span
							><span v-else-if="quote.result?.rows[$index]?.line_total != null" class="q-number">{{
								money(quote.result?.rows[$index]?.line_total, 2)
							}}</span
							><el-tag v-else-if="rowNeedsAttention($index)" type="danger" effect="dark" size="small">待确认</el-tag
							><span v-else class="q-muted">—</span></template
						></el-table-column
					>
					<el-table-column width="100" fixed="right"
						><template #default="{ row, $index }"
							><div class="material-status-cell">
								<el-button
									v-if="!locked && (!row.category || quote.result?.rows[$index]?.status === 'pending')"
									link
									type="primary"
									@click="openProductRule(row)"
								>
									匹配规则
								</el-button>
								<el-button :type="!dirty && rowNeedsAttention($index) ? 'danger' : 'primary'" link @click="openRow(row)">{{
									!dirty && rowNeedsAttention($index) ? '立即处理' : '参数 / 明细'
								}}</el-button>
							</div></template
						></el-table-column
					>
				</el-table>
				<details v-if="quote.body.source_sheets?.length" style="margin-top: 12px">
					<summary>查看整份文件导入情况（{{ quote.body.source_sheets.length }} 个工作表）</summary>
					<p v-for="sheet in quote.body.source_sheets" :key="sheet.name" class="q-muted">
						{{ sheet.name }}：{{
							sheet.status === 'imported'
								? `已导入 ${sheet.row_count} 个产品行`
								: sheet.status === 'empty'
								? '空白表'
								: `未参与报价，原因：${sheet.exclude_reason}`
						}}
					</p>
				</details>
				<details v-if="quote.body.source_special_rows?.length" style="margin-top: 12px">
					<summary>查看导入时提取的汇总行和备注（{{ quote.body.source_special_rows.length }} 行）</summary>
					<p class="q-muted" v-for="row in quote.body.source_special_rows" :key="`${row.source_sheet}-${row.source_row}`">
						{{ row.source_sheet }} · 原表第 {{ row.source_row }} 行：{{ row.original?.cells.join(' · ') || row.quantity }}
					</p>
				</details>
			</section>
			<section class="q-section">
				<div class="q-section-head">
					<h2>报价汇总</h2>
					<span class="q-muted">{{
						quote.result ? (isEquipment ? '设备按整数向上取整；风管保留 1 位小数' : '使用指标 V' + quote.result.duct_catalog?.version) : '尚未试算'
					}}</span>
				</div>
				<el-alert v-if="dirty" title="内容有修改，下方为上次试算结果。请保存并试算后再导出。" type="warning" :closable="false" />
				<el-alert
					v-if="quote.result?.manual_review_import"
					:title="`已回导人工校对结果：${quote.result.manual_review_import.filename}，共确认 ${quote.result.manual_review_import.change_count} 处修改。`"
					type="success"
					:closable="false"
					style="margin-top: 12px"
				/>
				<ul v-if="quote.result?.issues.length" class="q-issues">
					<li v-for="issue in quote.result.issues" :key="issue">{{ issue }}</li>
				</ul>
				<div class="q-summary">
					<div class="q-fees">
						<div class="q-fee">
							<span class="q-muted">产品行付款前小计{{ automaticEquipmentFreightIncluded ? '（设备运费已计入单价）' : '（含另列配件）' }}</span
							><strong class="q-number">¥ {{ money(quote.result?.subtotal, totalDigits) }}</strong>
						</div>
						<div v-if="hasDuctRows" class="q-fee">
							<span class="q-muted">风管运费</span>
							<strong>{{
								quote.body.include_freight === true ? '已计入风管材料单价' : quote.body.include_freight === false ? '不含运费' : '待确认'
							}}</strong>
						</div>
						<el-tooltip v-for="[key, label] in visibleFees" :key="key" :content="quote.result?.fees[key]?.reason || ''">
							<div class="q-fee">
								<span class="q-muted">{{ label }}</span
								><strong class="q-number">¥ {{ money(quote.result?.fees[key]?.amount) }}</strong>
							</div>
						</el-tooltip>
					</div>
					<div>
						<div class="q-muted">报价总额（元）</div>
						<div class="q-total q-number">{{ money(quote.result?.total, quote.result?.installation_engine_version ? 0 : totalDigits) }}</div>
					</div>
				</div>
				<p v-if="quote.result?.payment && !quote.result.manual_review_import" class="q-muted">
					{{ quote.result.payment.label }} · 付款系数 {{ quote.result.payment.coefficient }}，在产品行、另列设备运费与安装费合计后统一应用；付款前合计
					{{ money(quote.result.before_payment_total, 2) }} 元，付款调整 {{ money(quote.result.payment_amount, 2) }} 元，最终取整差额
					{{ money(quote.result.rounding_difference, 2) }} 元。
				</p>
				<div class="q-toolbar q-sticky">
					<template v-if="canExport"
						><el-button :disabled="!exportable" @click="exportQuote('draft')">导出可编辑校对版</el-button
						><el-button :disabled="!exportable || locked" @click="chooseReviewFile">导入已完善校对版</el-button
						><el-button type="primary" :disabled="!exportable || !quote.result?.formal_ready" @click="exportQuote('formal')"
							>生成正式报价</el-button
						></template
					>
					<span class="q-muted">导出校对版后在 Excel 中填写黄色项目，再回到这里导入；系统核对差异后即可生成正式报价。</span>
				</div>
			</section>
			<section v-if="quote.exports.length" class="q-section">
				<h2 style="margin-bottom: 14px">历史导出文件</h2>
				<div v-for="item in quote.exports" :key="item.id" class="q-toolbar" style="margin-bottom: 8px">
					<el-button link type="primary" :disabled="!canExport" @click="download(item)">{{ item.filename }}</el-button
					><span class="q-muted">{{ item.created_at }}</span>
				</div>
			</section>
		</template>
		<ImportDialog ref="importDialog" @created="navigate" />
		<AiImportDialog ref="aiImportDialog" />
		<ProductRuleDialog
			ref="productRuleDialog"
			:quote-body="quote?.body"
			:requires-ai-review="!!quote?.body.ai_review_status"
			:on-apply="applyProductRule"
		/>
		<input ref="reviewFile" type="file" accept=".xlsx" hidden @change="previewReviewFile" />
		<el-dialog v-model="reviewDialog" title="确认回导人工报价" width="min(1500px, 96vw)" top="4vh" class="review-import-dialog" destroy-on-close>
			<template v-if="reviewPreview">
				<el-alert
					:title="
						reviewPreview.pending_count
							? `仍有 ${reviewPreview.pending_count} 行价格未补全，回导后仍不能生成正式报价。`
							: `共识别 ${reviewPreview.change_count} 处修改，回导后付款前合计为 ${money(reviewPreview.before_payment_total)} 元。`
					"
					:type="reviewPreview.pending_count ? 'warning' : 'success'"
					:closable="false"
				/>
				<div class="review-import-summary">
					<div>
						<strong>{{ reviewPreview.changed_row_count }}</strong
						><span>修改产品</span>
					</div>
					<div>
						<strong>{{ reviewPreview.change_count }}</strong
						><span>人工修改</span>
					</div>
					<div>
						<strong>{{ reviewPreview.derived_count }}</strong
						><span>系统补算</span>
					</div>
					<div :class="{ warning: reviewPreview.pending_count }">
						<strong>{{ reviewPreview.pending_count }}</strong
						><span>仍待补全</span>
					</div>
					<div v-if="reviewPreview.column_count === 12">
						<strong>¥ {{ money(reviewPreview.material_total) }}</strong
						><span>材料费用</span>
					</div>
					<div v-if="quote?.body.include_freight && hasEquipmentRows">
						<strong>¥ {{ money(reviewPreview.equipment_freight_total) }}</strong
						><span>设备运费</span>
					</div>
					<div v-if="reviewPreview.column_count === 12">
						<strong>¥ {{ money(reviewPreview.installation_total) }}</strong
						><span>安装费用</span>
					</div>
					<div class="total">
						<span>付款前合计</span><strong>¥ {{ money(reviewPreview.before_payment_total) }}</strong>
					</div>
				</div>

				<section v-if="changedReviewRows.length" class="review-import-section">
					<div class="review-import-heading">
						<h3>已修改产品</h3>
						<span>修改后的值加粗显示，下面保留原值；蓝色项目由系统根据数量补算。</span>
					</div>
					<ReviewImportTable :rows="changedReviewRows" :installation="reviewPreview.column_count === 12" />
				</section>

				<section v-if="pendingReviewRows.length" class="review-import-section pending">
					<div class="review-import-heading">
						<h3>仍待补全产品</h3>
						<span>这些产品没有形成完整价格，回导后仍不能生成正式报价。</span>
					</div>
					<ReviewImportTable :rows="pendingReviewRows" :installation="reviewPreview.column_count === 12" />
				</section>

				<details v-if="unchangedReviewRows.length" class="review-import-unchanged">
					<summary>展开查看未修改产品（{{ unchangedReviewRows.length }} 项）</summary>
					<ReviewImportTable :rows="unchangedReviewRows" :installation="reviewPreview.column_count === 12" />
				</details>

				<p v-if="!reviewPreview.change_count" class="review-import-empty">没有检测到人工修改，请确认上传的是填写后的校对版。</p>
			</template>
			<template #footer>
				<el-button @click="reviewDialog = false">取消</el-button>
				<el-button type="primary" :disabled="!reviewPreview?.change_count" @click="applyReviewFile"
					>确认回导 {{ reviewPreview?.changed_row_count || 0 }} 个产品</el-button
				>
			</template>
		</el-dialog>
		<input ref="aiInputFile" type="file" accept=".xlsx" style="display: none" @change="previewAiInputFile" />
		<el-dialog
			v-model="aiInputDialog"
			title="导回已校验清单 · 核对修改"
			width="min(1100px, 96vw)"
			:close-on-click-modal="false"
			:close-on-press-escape="!aiInputBusy"
			:show-close="!aiInputBusy"
		>
			<p>{{ aiInputFilename }}</p>
			<el-alert v-if="aiInputBusy" title="正在处理清单，请等待完成。" type="info" :closable="false" show-icon />
			<el-alert v-if="aiInputError" :title="aiInputError" type="error" :closable="false" show-icon />
			<template v-if="aiInputPreview">
				<el-alert
					:title="`共 ${aiInputPreview.product_row_count} 条明细、${aiInputPreview.special_row_count} 条汇总或备注，修改了 ${aiInputPreview.changed_row_count} 行、${aiInputPreview.change_count} 个字段。确认后更新当前草稿，请继续完成“人工核验完成”和“保存并试算”。`"
					type="warning"
					:closable="false"
					show-icon
				/>
				<p class="q-muted">
					主表可修改名称、规格、厚度、法兰、单位、数量和备注，“人工核对”表可补充参数。请保留整份文件，不增删或排序产品行；新增材料或取消计价请在系统中操作，金额由系统试算生成。
				</p>
				<p class="q-muted">客户名称、项目和报价日期等信息请在工作台页面修改。</p>
				<el-table v-if="aiInputPreview.change_count" :data="aiInputPreview.changes" border max-height="440" class="ai-input-changes">
					<el-table-column prop="visible_row" label="Excel行" width="90" />
					<el-table-column prop="name" label="产品" min-width="150" show-overflow-tooltip />
					<el-table-column prop="field_label" label="修改项目" width="145" />
					<el-table-column label="修改前" min-width="230">
						<template #default="{ row }"
							><span class="ai-input-value">{{ row.before || '（空）' }}</span></template
						>
					</el-table-column>
					<el-table-column label="修改后" min-width="230">
						<template #default="{ row }"
							><strong class="ai-input-value">{{ row.after || '（空）' }}</strong></template
						>
					</el-table-column>
				</el-table>
				<p v-else class="q-muted">
					没有发现内容修改，可以关闭此窗口{{ aiReviewPending ? '，继续在草稿中确认“人工核验完成”。' : '继续处理草稿。' }}
				</p>
			</template>
			<template #footer>
				<el-button :disabled="aiInputBusy" @click="aiInputDialog = false">取消</el-button>
				<el-button type="primary" :loading="aiInputBusy" :disabled="!aiInputPreview?.change_count || !!aiInputError" @click="applyAiInputFile">
					确认更新原草稿
				</el-button>
			</template>
		</el-dialog>
		<el-drawer
			v-model="drawer"
			:title="'第 ' + (selected + 1) + ' 项 · 参数与计算明细'"
			size="min(580px, 96vw)"
			class="quotation-drawer"
			destroy-on-close
		>
			<div v-if="selectedRow" class="quotation-page">
				<el-alert
				v-if="selectedResult?.reason || (canShowReviewReason() && selectedRow?.attributes.review_reason)"
					:title="selectedResult?.reason || selectedRow?.attributes.review_reason"
					type="warning"
					:closable="false"
					style="margin-bottom: 14px"
				/>
				<div class="q-toolbar" style="margin-bottom: 14px">
					<el-tag v-if="selectedRuleBody" effect="plain"
						>{{ selectedRuleBody.name }} · {{ selectedRow.product_rule ? '本次报价规则' : '发布规则' }}</el-tag
					>
					<el-button v-if="!locked" link type="primary" @click="openProductRule(selectedRow)">{{
						selectedRuleBody ? '查看 / 调整产品规则' : '匹配或新增产品规则'
					}}</el-button>
					<el-button v-if="!locked && (selectedRow.product_rule || selectedRow.product_rule_family)" link type="danger" @click="clearProductRule"
						>恢复自动匹配</el-button
					>
				</div>
				<el-form label-position="top" :disabled="locked" class="q-grid two" @submit.prevent>
					<el-form-item label="产品名称" class="q-wide"><el-input v-model="selectedRow.name" /></el-form-item>
					<el-form-item label="规格描述" class="q-wide"><el-input v-model="selectedRow.spec" type="textarea" /></el-form-item>
					<el-form-item v-if="!selectedEquipment" label="工程量总面积（㎡）"><el-input v-model="selectedRow.engineering_quantity" /></el-form-item>
					<template v-else>
						<el-form-item label="设备数量"><el-input v-model="selectedRow.quantity" /></el-form-item>
						<el-form-item label="客户单位"><el-input v-model="selectedRow.unit" placeholder="台 / 个 / ㎡" /></el-form-item>
						<p class="q-muted q-wide">规格中明确写出的尺寸和参数会自动识别；手工补填参数优先。无法唯一选型时，请核对并选择候选。</p>
					</template>
					<el-form-item label="产品类别"
						><el-select v-model="selectedRow.category"
							><el-option label="待确认" value="" /><el-option
								v-for="category in isEquipment || selectedRuleBody ? [...equipmentCategories, '组合产品', '自定义产品'] : ['风管']"
								:key="category"
								:label="category"
								:value="category" /></el-select
					></el-form-item>
					<div v-if="selectedEquipment" class="drawer-subheading q-wide">
						<h3>{{ selectedRuleBody?.rule_type === 'formula' ? '本单计算参数' : '客户需求参数' }}</h3>
						<span>{{
							selectedRuleBody?.rule_type === 'formula' ? '本行输入优先，不会修改常用规则默认值' : '用于系统选型，空缺项可根据客户清单补充'
						}}</span>
					</div>
					<el-form-item v-for="field in selectedFields" :key="field.key" :label="field.label">
						<el-select v-if="field.choices" v-model="selectedRow.attributes[field.key]" clearable placeholder="按清单 / 整单条件">
							<el-option v-for="[value, label] in field.choices" :key="value" :value="value" :label="label" />
						</el-select>
						<el-input v-else v-model="selectedRow.attributes[field.key]" :placeholder="field.placeholder || '清单缺项时补充'" />
					</el-form-item>
					<el-form-item
						v-for="parameter in selectedCustomParameters"
						:key="parameter.key"
						:label="parameter.label + (parameter.unit ? '（' + parameter.unit + '）' : '')"
					>
						<el-input v-if="parameter.source === 'catalog_rate'" model-value="跟随已发布成本指标" disabled />
						<el-input
							v-else
							:model-value="selectedRow.attributes[parameter.key] ?? parameter.default_value ?? ''"
							inputmode="decimal"
							placeholder="填写本单数值"
							@update:model-value="selectedRow.attributes[parameter.key] = $event"
						/>
					</el-form-item>
					<section v-if="selectedRow.category === '风机'" class="fan-selection q-wide">
						<div class="drawer-section-heading">
							<h3>系统选型结果</h3>
							<el-tag v-if="selectedFan" type="success" effect="light">{{ dirty ? '上次选型' : '已选型' }}</el-tag>
							<el-tag v-else-if="selectedResult?.candidates?.length" type="danger" effect="dark">待选择候选</el-tag>
							<el-tag v-else type="warning" effect="light">待选型</el-tag>
						</div>
						<template v-if="selectedFan">
							<strong class="fan-selection-name">{{ selectedFanDisplayName || '已选风机' }}</strong>
							<div class="fan-selection-grid">
								<div>
									<span>风机型号</span><strong>{{ selectedFan.model || '—' }}</strong>
								</div>
								<div>
									<span>机号</span><strong>{{ selectedFan.size || '—' }}</strong>
								</div>
								<div>
									<span>功率</span><strong>{{ selectedFan.powers?.join('/') || '—' }} kW</strong>
								</div>
								<div>
									<span>风量</span><strong>{{ selectedFan.airflow || '—' }} m³/h</strong>
								</div>
								<div>
									<span>风压</span><strong>{{ selectedFan.pressure || '—' }} Pa</strong>
								</div>
								<div>
									<span>转速</span><strong>{{ selectedFan.speed || '—' }} r/min</strong>
								</div>
								<div v-if="selectedFan.airflow_low">
									<span>低速档风量</span><strong>{{ selectedFan.airflow_low }} m³/h</strong>
								</div>
								<div v-if="selectedFan.pressure_low">
									<span>低速档风压</span><strong>{{ selectedFan.pressure_low }} Pa</strong>
								</div>
								<div v-if="selectedFan.poles?.length">
									<span>电机极数</span><strong>{{ selectedFan.poles.join('/') }} 极</strong>
								</div>
								<div v-if="selectedFan.source">
									<span>数据来源</span><strong>{{ selectedFan.source }}</strong>
								</div>
							</div>
							<p v-if="selectedResult?.detail?.selection_note" class="fan-selection-note">选型说明：{{ selectedResult.detail.selection_note }}</p>
							<p v-if="selectedFan.quality_note" class="q-error">数据提示：{{ selectedFan.quality_note }}</p>
							<p v-if="dirty" class="q-error">客户需求参数已修改，上述为上次选型结果，请重新保存并试算。</p>
						</template>
						<template v-else-if="selectedResult?.candidates?.length">
							<p class="q-error">找到 {{ selectedResult.candidates.length }} 个符合条件的风机，请确认最终采用的型号。</p>
							<el-radio-group v-model="selectedRow.candidate_id" :disabled="locked" aria-label="风机候选" class="fan-candidates">
								<el-radio v-for="candidate in selectedResult.candidates" :key="candidate.id" :label="candidate.id">
									<strong>{{ candidate.body.name }}</strong
									>；机号 {{ candidate.body.attributes.size || '—' }}；功率 {{ candidate.body.attributes.powers.join('/') }} kW；风量
									{{ candidate.body.attributes.airflow }} m³/h；风压 {{ candidate.body.attributes.pressure }} Pa；转速
									{{ candidate.body.attributes.speed }} r/min
								</el-radio>
							</el-radio-group>
							<p class="q-muted">选择候选后，请保存并重新试算以确认最终结果。</p>
						</template>
						<p v-else class="q-muted">{{ selectedResult?.reason || '保存并试算后，系统会在这里显示最终选中的风机及完整参数。' }}</p>
					</section>
					<el-form-item label="客户备注" class="q-wide"><el-input v-model="selectedRow.remark" type="textarea" /></el-form-item>
					<div class="q-wide">
						<el-checkbox v-model="selectedRow.excluded">本行不计价（标题、合计或范围外项目）</el-checkbox>
						<el-input v-if="selectedRow.excluded" v-model="selectedRow.exclude_reason" placeholder="必须填写不计价原因" style="margin: 8px 0" />
						<el-checkbox v-if="selectedRow.source_issue" v-model="selectedRow.source_issue_confirmed"
							>已核对原文件公式或错误值，并补入正确数据</el-checkbox
						>
					</div>
				</el-form>
				<section v-if="quote.body.installation_options?.included && selectedRow.installation" class="drawer-installation">
					<div class="drawer-section-heading">
						<h2>本行安装条件</h2>
						<el-tag v-if="selectedResult?.installation_status === 'priced'" type="success" effect="light">已计算</el-tag>
						<el-tag v-else-if="selectedResult?.installation_status === 'pending'" type="danger" effect="dark">待确认</el-tag>
						<el-tag v-else-if="selectedResult?.installation_status === 'excluded'" type="info" effect="plain">不含安装</el-tag>
					</div>
					<p class="q-muted">只调整当前产品的安装项目、数量、单位或人工确认单价，不会自动同步到其他产品。</p>
					<InstallationEntryFields
						:entry="selectedRow.installation"
						:options="quote.body.installation_options"
						:row-category="selectedRow.category"
						:row-name="selectedRow.name"
						:row-spec="selectedRow.spec"
						:catalog="activeInstallation"
						:locked="locked"
						:status="selectedResult?.installation_status"
						:reason="selectedResult?.installation_reason"
					/>
				</section>
				<details style="margin: 20px 0">
					<summary>原始客户清单内容</summary>
					<p v-if="selectedRow.source_sheet" class="q-muted">{{ selectedRow.source_sheet }} · 原表第 {{ selectedRow.source_row }} 行</p>
					<p v-if="selectedRow.original?.source_file" class="q-muted">
						客户来源：{{ selectedRow.original.source_file }} · {{ selectedRow.original.source_sheet }} {{ selectedRow.original.source_locator }}
					</p>
					<p v-if="selectedRow.original?.source_excerpt" class="q-muted">来源文字：{{ selectedRow.original.source_excerpt }}</p>
					<p class="q-muted">{{ selectedRow.original?.cells.join(' | ') || '手工建立' }}</p>
				</details>
				<section v-if="selectedResult" class="q-section">
					<h2>上次计算过程</h2>
					<details v-if="selectedResult.detail?.components" style="margin: 12px 0">
						<summary>产品成本分项（内部核对）</summary>
						<template v-if="Array.isArray(selectedResult.detail.components)">
							<div v-for="(component, index) in selectedResult.detail.components" :key="index" class="q-trace">
								<strong
									>{{ component.name }}<span>{{ money(component.amount, 2) }} 元</span></strong
								><code>用量 {{ component.quantity }} × 未税成本 {{ component.unit_cost }} 元</code>
							</div>
						</template>
						<div
							v-for="(value, key) in Array.isArray(selectedResult.detail.components) ? {} : selectedResult.detail.components"
							:key="key"
							class="q-trace"
						>
							<strong
								>{{ equipmentComponents[key] || key }}<span>{{ value }}</span></strong
							>
						</div>
					</details>
					<p v-if="dirty" class="q-muted">参数修改后需重新试算。</p>
					<details v-if="selectedResult.detail?.parameters?.length" class="rule-parameter-values">
						<summary>上次试算采用的参数</summary>
						<p v-for="parameter in selectedResult.detail.parameters" :key="parameter.key" class="q-muted">
							{{ parameter.label }}：{{ parameter.value ?? '未使用' }} {{ parameter.unit
							}}{{ parameter.source === 'catalog_rate' ? ' · 已发布成本指标' : '' }}
						</p>
					</details>
					<div v-for="(step, index) in selectedResult.trace" :key="index" class="q-trace">
						<strong
							>{{ step.step }} <span>{{ step.value }}</span></strong
						><code>{{ formulaTraceExpression(step.expression) }}</code>
					</div>
					<div v-if="!selectedEquipment" class="q-trace">
						<strong
							>按平方米金额 <span>{{ money(selectedResult.body_amount) }}</span></strong
						>
					</div>
					<div v-if="selectedResult.flange_amount" class="q-trace">
						<strong
							>本行实际米数角钢法兰 <span>{{ money(selectedResult.flange_amount) }}</span></strong
						>
					</div>
					<div v-if="selectedResult.round_flange_amount" class="q-trace">
						<strong
							>本行圆法兰另计金额 <span>{{ money(selectedResult.round_flange_amount) }}</span></strong
						>
					</div>
					<div class="q-trace">
						<strong
							>材料金额 <span>{{ money(selectedResult.amount, rowDigits(selected)) }}</span></strong
						>
					</div>
					<div v-if="quote.body.installation_options?.included" class="q-trace">
						<strong
							>安装费用
							<span>{{ selectedResult.installation_status === 'pending' ? '待确认' : money(selectedResult.installation_amount, 2) }}</span></strong
						>
						<code v-if="selectedResult.installation_reason">{{ selectedResult.installation_reason }}</code>
					</div>
					<div v-if="quote.body.installation_options?.included" class="q-trace">
						<strong
							>本行报价 <span>{{ money(selectedResult.line_total, 2) }}</span></strong
						>
					</div>
				</section>
			</div>
			<template #footer><el-button @click="drawer = false">完成核对</el-button></template>
		</el-drawer>
	</main>
</template>
<script setup lang="ts" name="QuotationWorkbench">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';
import { ElMessage } from 'element-plus';
import { auth } from '/@/utils/authFunction';
import { quoteApi } from '/@/api/quotation';
import { money, stateLabels, report, confirm, blankRow, rowFields, flangeTypes, shapes, productStates } from '/@/views/quotation/shared';
import type { Catalog, Quote, QuoteRow, ExportRecord, InstallationCatalogBody, ReviewImportPreview, AiInputImportPreview, ProductRuleBody } from '/@/types/quotation';
import ProductRuleDialog from './ProductRuleDialog.vue';
import InstallationPanel from './InstallationPanel.vue';
import InstallationEntryFields from './InstallationEntryFields.vue';
import ReviewImportTable from './ReviewImportTable.vue';
import { prepareInstallation, blankInstallation } from '/@/views/quotation/installation';
import QuoteList from '/@/views/quotation/QuoteList.vue';
import ImportDialog from '/@/views/quotation/ImportDialog.vue';
import AiImportDialog from '/@/views/quotation/AiImportDialog.vue';
import '/@/views/quotation/quotation.scss';
import { equipmentCategories, equipmentFields, equipmentFieldsFor, equipmentComponents } from '/@/views/quotation/equipment';
const route = useRoute(),
	router = useRouter();
const quote = ref<Quote>(),
	catalogs = ref<Catalog[]>([]),
	busy = ref(false),
	saving = ref(false),
	failed = ref(false),
	baseline = ref('');
const importDialog = ref<InstanceType<typeof ImportDialog>>(),
	aiImportDialog = ref<InstanceType<typeof AiImportDialog>>(),
	productRuleDialog = ref<InstanceType<typeof ProductRuleDialog>>(),
	productRules = ref<Catalog<ProductRuleBody>[]>([]),
	reviewFile = ref<HTMLInputElement>(),
	reviewDialog = ref(false),
	reviewPreview = ref<ReviewImportPreview>(),
	aiInputFile = ref<HTMLInputElement>(),
	aiInputDialog = ref(false),
	aiInputBusy = ref(false),
	aiInputPreview = ref<AiInputImportPreview>(),
	aiInputTarget = ref<{ id: string; revision: number }>(),
	aiInputFilename = ref(''),
	aiInputError = ref(''),
	drawer = ref(false),
	selected = ref(0),
	sections = ref(['conditions']);
const canEdit = computed(() => auth('quote_edit')),
	canExport = computed(() => auth('quote_export'));
const locked = computed(() => !canEdit.value || quote.value?.state !== 'draft');
const changedReviewRows = computed(() => reviewPreview.value?.review_rows.filter((row) => row.changed) || []),
	pendingReviewRows = computed(() => reviewPreview.value?.review_rows.filter((row) => row.pending && !row.changed) || []),
	unchangedReviewRows = computed(() => reviewPreview.value?.review_rows.filter((row) => !row.changed && !row.pending) || []);
const options = computed(() => quote.value!.body.duct_options);
const isAuto = computed(() => quote.value?.body.recognition_mode === 'auto_v1');
const aiReviewPending = computed(() => quote.value?.body.ai_review_status === 'pending');
const aiUnknownNameCount = computed(() => quote.value?.body.rows.filter((row) => row.name === '待识别材料').length || 0);
const hasDuctRows = computed(() => quote.value?.body.rows.some((row) => !row.excluded && row.category === '风管'));
const hasEquipmentRows = computed(() => quote.value?.body.rows.some((row) => !row.excluded && row.category && row.category !== '风管'));
const recognitionSummary = computed(() => {
	const rows = quote.value?.body.rows || [];
	return `风管 ${rows.filter((row) => row.category === '风管').length} 项 / 设备 ${
		rows.filter((row) => row.category && row.category !== '风管').length
	} 项 / 待识别 ${rows.filter((row) => !row.category).length} 项`;
});
const isEquipment = computed(() => ['equipment_v1', 'mixed_v1'].includes(quote.value?.body.pricing_mode || ''));
const orderOptions = computed(() => (isEquipment.value ? quote.value?.body.equipment_options : undefined) || options.value);
const selectedEquipment = computed(() =>
	selectedRuleBody.value
		? selectedRuleBody.value.rule_type === 'combination' || selectedRuleBody.value.category !== '风管'
		: isEquipment.value && (quote.value?.body.pricing_mode === 'equipment_v1' || selectedRow.value?.category !== '风管')
);
const selectedRuleBody = computed(() => {
	const row = selectedRow.value;
	if (row?.product_rule) return row.product_rule;
	if (row?.product_rule_family) return activeProductRule(row.product_rule_family)?.body || selectedResult.value?.product_rule?.body;
	const matched = selectedResult.value?.product_rule;
	const body = (matched?.family ? activeProductRule(matched.family)?.body : undefined) || matched?.body;
	const normalizeName = (value: string) => value.toUpperCase().replace(/\s/g, '').replace(/（/g, '(').replace(/）/g, ')');
	const sameName = (candidate: ProductRuleBody) =>
		!!row && [candidate.name, ...(candidate.aliases || [])].some((name) => normalizeName(name) === normalizeName(row.name));
	if (body && sameName(body)) return body;
	if (!row) return;
	const normalizeUnit = (value: string) =>
		(({ m2: '㎡', 'm²': '㎡', 平方米: '㎡', m: '米', 公斤: 'kg' } as Record<string, string>)[value.trim().toLowerCase()] || value.trim().toLowerCase());
	const candidates = productRules.value.filter(
		(rule) => activeProductRule(rule.family)?.id === rule.id && sameName(rule.body) && normalizeUnit(rule.body.unit) === normalizeUnit(row.unit)
	);
	// Display an unambiguous rule before calculation; conditional matching stays in the pricing engine.
	return candidates.length === 1 && !Object.keys(candidates[0].body.conditions || {}).length ? candidates[0].body : undefined;
});
const selectedCustomParameters = computed(() =>
	selectedRuleBody.value?.rule_type === 'formula' ? selectedRuleBody.value.custom_cost?.parameters || [] : []
);
const selectedFields = computed<{ key: string; label: string; choices?: string[][]; placeholder?: string }[]>(() => {
	if (selectedRuleBody.value?.rule_type === 'formula') {
		const variables = new Set(
			(selectedRuleBody.value.custom_cost?.costs || []).flatMap((cost) => cost.expression.match(/[a-zA-Z][a-zA-Z0-9_]*/g) || [])
		);
		if (variables.has('area') || variables.has('perimeter')) {
			variables.add('width');
			variables.add('height');
		}
		return equipmentFields.filter((field) => ['width', 'height', 'length', 'diameter', 'thickness'].includes(field.key) && variables.has(field.key));
	}
	if (selectedRuleBody.value?.rule_type === 'combination')
		return equipmentFields.filter((field) =>
			['width', 'height', 'length', 'diameter', 'thickness', 'material', 'shape', 'layer'].includes(field.key)
		);
	return selectedEquipment.value
		? equipmentFieldsFor(
				selectedRow.value?.category || '',
				selectedRow.value?.attributes.equipment_kind || selectedRuleBody.value?.attributes.equipment_kind || ''
		  )
		: rowFields;
});
const dirty = computed(() => !!quote.value && JSON.stringify(quote.value.body) !== baseline.value);
const selectedRow = computed(() => quote.value?.body.rows[selected.value]),
	selectedResult = computed(() => quote.value?.result?.rows[selected.value]);
const selectedFan = computed(() => selectedResult.value?.detail?.selected_fan);
const selectedFanDisplayName = computed(() =>
	[selectedFan.value?.family, selectedFan.value?.model].filter((value, index, values) => value && values.indexOf(value) === index).join(' · ')
);
const exportable = computed(() => !!quote.value?.result && !dirty.value && !quote.value?.result_stale && quote.value?.state !== 'archived');
const feeLabels = [
	['equipment_freight', '设备运费'],
	['aggregate_flanges', '整单法兰（已含）'],
	['accessories', '整单配件（已含）'],
	['installation', '安装费'],
	['tax', '税费差额（已含）'],
];
const automaticEquipmentFreightIncluded = computed(() => !!quote.value?.result?.fees?.equipment_freight?.included_in_rows);
const visibleFees = computed(() =>
	isEquipment.value
		? feeLabels
				.filter(([key]) => quote.value?.result?.fees[key])
				.map(([key, label]) => [
					key,
					key === 'tax'
						? '风管' + label
						: key === 'equipment_freight'
						? automaticEquipmentFreightIncluded.value
							? '设备运费（已计入设备单价）'
							: '设备运费（另列）'
						: label,
				])
		: feeLabels
);
const totalDigits = computed(() => (quote.value?.body.pricing_mode === 'equipment_v1' ? 0 : 1));
function rowDigits(index: number) {
	return isEquipment.value && (quote.value?.body.pricing_mode === 'equipment_v1' || quote.value?.body.rows[index]?.category !== '风管') ? 0 : 1;
}
function activeResource(kind: string) {
	const day = new Date().toLocaleDateString('sv-SE'),
		families = new Map<string, Catalog>();
	for (const c of catalogs.value) {
		if (c.kind !== kind || !['published', 'retired'].includes(c.status) || c.body.effective_from > day) continue;
		if (!families.has(c.family) || families.get(c.family)!.version < c.version) families.set(c.family, c);
	}
	const active = [...families.values()].filter((c) => c.status === 'published' && (!c.body.effective_to || c.body.effective_to >= day));
	return active.length === 1 ? active[0] : undefined;
}
const activeCatalog = computed(() => activeResource('duct_catalog'));
const activeEquipment = computed(() => activeResource('equipment_catalog'));
const activeInstallation = computed(() => activeResource('installation_catalog')?.body as unknown as InstallationCatalogBody | undefined);
const orderPaymentTerms = computed(() =>
	((!isEquipment.value || (isAuto.value && !hasEquipmentRows.value) ? activeCatalog.value : activeEquipment.value)?.body.payment_terms || []).filter(
		(t) => t.mode === (quote.value?.body.installation_options?.included ? 'with_install' : 'no_install')
	)
);
function syncEquipment() {
	if (quote.value?.body.pricing_mode !== 'mixed_v1' || !quote.value.body.equipment_options) return;
	options.value.tax_included = quote.value.body.equipment_options.tax_included;
	options.value.payment_option = quote.value.body.equipment_options.payment_option;
	options.value.include_installation = !!quote.value.body.installation_options?.included;
}
function freightChanged() {
	if (!quote.value || quote.value.body.include_freight == null) return;
	options.value.include_freight = quote.value.body.include_freight;
	if (quote.value.body.equipment_options) quote.value.body.equipment_options.include_freight = quote.value.body.include_freight;
}
function installationChanged() {
	if (!quote.value) return;
	const included = !!quote.value.body.installation_options?.included;
	const currentPayment = options.value.payment_option || '';
	const cashPayment = included ? 'with_install_cash' : 'no_install_cash';
	options.value.include_installation = included;
	options.value.payment_option = currentPayment.endsWith('_cash') ? cashPayment : '';
	if (quote.value.body.equipment_options) {
		quote.value.body.equipment_options.include_installation = included;
		quote.value.body.equipment_options.payment_option = options.value.payment_option;
	}
	if (included && !activeInstallation.value) ElMessage.warning('安装费暂时无法试算：请负责人先到“指标管理 → 安装指标”发布一个生效版本');
	else if (!options.value.payment_option) ElMessage.warning('安装前后的付款方案不同，请重新选择整单付款方式');
}
function materialSummary(index: number) {
	const row = quote.value!.body.rows[index],
		result = quote.value?.result?.rows[index],
		quantity = result?.billing_quantity || (row.category === '风管' ? row.engineering_quantity : row.quantity),
		unit = result?.billing_unit || (row.category === '风管' ? '㎡' : row.unit),
		baseAmount = result?.body_amount ?? result?.amount;
	return `${quantity || '—'} ${unit || ''} × ${money(result?.unit_price, rowDigits(index))} 元/${unit || '单位'} = ${money(
		baseAmount,
		rowDigits(index)
	)} 元`;
}
function materialExtraSummary(index: number) {
	const result = quote.value?.result?.rows[index],
		parts: string[] = [];
	if (result?.flange_amount != null && Number(result.flange_amount) !== 0)
		parts.push(`角钢法兰另计 ${money(result.flange_amount, rowDigits(index))} 元`);
	if (result?.round_flange_amount != null && Number(result.round_flange_amount) !== 0)
		parts.push(`圆法兰另计 ${money(result.round_flange_amount, rowDigits(index))} 元`);
	if (parts.length && result?.amount != null) parts.push(`材料合计 ${money(result.amount, rowDigits(index))} 元`);
	return parts.join('；');
}
function canShowReviewReason() {
	return !quote.value?.body.ai_review_status || !!quote.value?.result;
}
function rowNeedsAttention(index: number) {
	const result = quote.value?.result?.rows[index];
	return result?.status === 'pending' || result?.installation_status === 'pending'
		|| (canShowReviewReason() && !!quote.value?.body.rows[index]?.attributes.review_reason);
}
function rowClass({ row, rowIndex }: { row: QuoteRow; rowIndex: number }) {
	const result = quote.value?.result?.rows[rowIndex];
	return row.excluded
		? 'excluded-row'
		: result?.status === 'pending' || result?.installation_status === 'pending'
			|| (canShowReviewReason() && row.attributes.review_reason)
		? 'pending-row'
		: '';
}
function openRow(row: QuoteRow) {
	selected.value = quote.value!.body.rows.indexOf(row);
	drawer.value = true;
}
function openProductRule(row: QuoteRow) {
	selected.value = quote.value!.body.rows.indexOf(row);
	const body = selectedRuleBody.value;
	const family =
		body && !row.product_rule
			? row.product_rule_family ||
			  selectedResult.value?.product_rule?.family ||
			  productRules.value.find((rule) => rule.body === body && activeProductRule(rule.family)?.id === rule.id)?.family
			: undefined;
	productRuleDialog.value?.open(row, body, family);
}
function activeProductRule(family: string) {
	const date = new Date().toLocaleDateString('sv-SE');
	const latest = productRules.value
		.filter((rule) => rule.family === family && ['published', 'retired'].includes(rule.status) && (rule.body.effective_from || '') <= date)
		.sort((a, b) => b.version - a.version)[0];
	return latest?.status === 'published' && (!latest.body.effective_to || latest.body.effective_to >= date) ? latest : undefined;
}
async function applyProductRule(definition: { body: ProductRuleBody; family?: string; row: QuoteRow }) {
	if (!quote.value || locked.value) return false;
	const { body, family } = definition;
	const index = quote.value.body.rows.findIndex(
		(candidate) => candidate === definition.row || (!!definition.row.row_id && candidate.row_id === definition.row.row_id)
	);
	if (index < 0) {
		ElMessage.warning('当前清单行已变化，请重新打开规则配置');
		return false;
	}
	const row = quote.value.body.rows[index];
	const quoteId = quote.value.id;
	if (row !== definition.row) {
		row.spec = definition.row.spec;
		row.quantity = definition.row.quantity;
		row.engineering_quantity = definition.row.engineering_quantity;
		row.attributes = definition.row.attributes;
	}
	if (family) {
		row.product_rule_family = family;
		delete row.product_rule;
	} else {
		row.product_rule = body;
		delete row.product_rule_family;
	}
	if (body.category) row.category = body.category;
	row.unit = body.unit;
	if (body.rule_type !== 'alias' && body.unit === '㎡' && !row.quantity) row.quantity = row.engineering_quantity;
	selected.value = index;
	drawer.value = false;
	const requiresAiReview = !!quote.value.body.ai_review_status;
	const saved = await save(!requiresAiReview);
	if (!saved && quote.value?.id === quoteId && quote.value.body.rows[index]) Object.assign(definition.row, quote.value.body.rows[index]);
	if (saved) {
		try {
			productRules.value = await quoteApi.productRules();
		} catch (error) {
			report(error);
		}
	}
	return saved;
}
function clearProductRule() {
	if (!selectedRow.value || locked.value) return;
	delete selectedRow.value.product_rule;
	delete selectedRow.value.product_rule_family;
	ElMessage.success('已恢复自动匹配，请重新识别或保存试算');
}
function formulaTraceExpression(expression: string) {
	if (!selectedResult.value?.detail?.formula_costs) return expression;
	const labels: Record<string, string> = {
		width: '宽度',
		height: '高度',
		length: '长度',
		diameter: '直径',
		thickness: '厚度',
		area: '正面面积',
		perimeter: '矩形周长',
	};
	for (const parameter of selectedResult.value.detail.parameters || []) labels[parameter.key] = parameter.label;
	return expression
		.replace(/[a-zA-Z][a-zA-Z0-9_]*/g, (key) => labels[key] || key)
		.replace(/\*/g, ' × ')
		.replace(/\//g, ' ÷ ');
}
function addRow() {
	const row = blankRow();
	row.installation = blankInstallation();
	if (isEquipment.value) {
		row.category = '';
		row.unit = '';
	}
	quote.value!.body.rows.push(row);
	selected.value = quote.value!.body.rows.length - 1;
	drawer.value = true;
}
function stateChanged() {
	if (!options.value.shape) options.value.shape = 'semi_unspecified';
}
async function navigate(id: string) {
	await router.push({ path: '/quotation/workbench/index', query: { id } });
}
async function loadQuote(id: string) {
	const value = await quoteApi.detail(id);
	prepareInstallation(value.body);
	quote.value = value;
	baseline.value = JSON.stringify(value.body);
	drawer.value = false;
}
async function initialize() {
	busy.value = true;
	failed.value = false;
	try {
		[catalogs.value, productRules.value] = await Promise.all([quoteApi.resources(), quoteApi.productRules()]);
		if (route.query.id) await loadQuote(String(route.query.id));
		else quote.value = undefined;
	} catch (error) {
		failed.value = true;
		report(error);
	} finally {
		busy.value = false;
	}
}
async function createBlank() {
	busy.value = true;
	try {
		const created = await quoteApi.create({ pricing_mode: 'auto_v1' });
		await navigate(created.id);
	} catch (error) {
		report(error);
	} finally {
		busy.value = false;
	}
}
async function save(calculate: boolean) {
	if (!quote.value) return false;
	if (calculate && aiReviewPending.value) {
		ElMessage.warning('请先人工核验AI清单');
		return false;
	}
	if (calculate && quote.value.body.include_freight == null) {
		ElMessage.warning('请先选择整单是否含运费');
		return false;
	}
	saving.value = true;
	busy.value = true;
	try {
		const id = quote.value.id;
		if (dirty.value || quote.value.body.ai_review_status !== 'approved') {
			const saved = await quoteApi.save(id, quote.value.body, quote.value.revision);
			quote.value.revision = saved.revision;
			quote.value.result = null;
			// Reload row IDs and clear the dirty baseline before a possible calculation failure.
			await loadQuote(id);
		}
		if (calculate) {
			if (aiReviewPending.value) {
				ElMessage.warning('草稿修改后请重新人工核验，再试算');
				return false;
			}
			await quoteApi.calculate(id, quote.value.revision);
			await loadQuote(id);
		}
		ElMessage.success(calculate ? (quote.value.result?.formal_ready ? '试算完成，可以生成正式报价' : '试算完成，请核对待确认项') : '草稿已保存');
		return true;
	} catch (error) {
		report(error);
		return false;
	} finally {
		saving.value = false;
		busy.value = false;
	}
}
async function approveAi() {
	if (!quote.value || !aiReviewPending.value) return;
	if (dirty.value && !(await save(false))) return;
	try {
		await confirm('请确认已对照客户原始资料核对全部AI清单行，包括遗漏、规格、数量和单位。');
		busy.value = true;
		await quoteApi.approveAi(quote.value.id, quote.value.revision);
		await loadQuote(quote.value.id);
		ElMessage.success('人工核验已记录，现在可以试算');
	} catch (error) {
		report(error);
	} finally {
		busy.value = false;
	}
}
async function downloadStandard() {
	if (!quote.value) return;
	if (dirty.value) {
		ElMessage.warning('请先保存草稿，再下载当前版本的待核验报价单');
		return;
	}
	try {
		await quoteApi.downloadStandardInput(quote.value.id);
	} catch (error) {
		report(error);
	}
}

function chooseAiInputFile() {
	if (!quote.value || locked.value || !quote.value.body.ai_review_status) return;
	if (dirty.value) {
		ElMessage.warning('页面有未保存修改，请先保存草稿，再下载当前版本的清单校验后回导');
		return;
	}
	aiInputFile.value?.click();
}

async function previewAiInputFile(event: Event) {
	const input = event.target as HTMLInputElement,
		file = input.files?.[0];
	input.value = '';
	if (!file || !quote.value || locked.value || aiInputBusy.value) return;
	if (dirty.value) {
		ElMessage.warning('页面有未保存修改，请先保存草稿，再上传已校验清单');
		return;
	}
	aiInputPreview.value = undefined;
	aiInputError.value = '';
	aiInputFilename.value = file.name;
	aiInputTarget.value = { id: quote.value.id, revision: quote.value.revision };
	aiInputDialog.value = true;
	if (!file.name.toLowerCase().endsWith('.xlsx')) {
		aiInputError.value = '请选择从当前AI草稿下载并校验后的 .xlsx 文件';
		return;
	}
	aiInputBusy.value = true;
	try {
		aiInputPreview.value = await quoteApi.previewAiInputImport(aiInputTarget.value.id, aiInputTarget.value.revision, file);
	} catch (error) {
		const detail = error as { msg?: string; message?: string };
		aiInputError.value = detail?.msg || detail?.message || '清单校验失败，请检查文件后重新上传';
	} finally {
		aiInputBusy.value = false;
	}
}

async function applyAiInputFile() {
	if (!quote.value || !aiInputPreview.value?.change_count || !aiInputTarget.value || locked.value || aiInputBusy.value) return;
	if (dirty.value || quote.value.id !== aiInputTarget.value.id || quote.value.revision !== aiInputTarget.value.revision) {
		aiInputError.value = '当前草稿已有变化，请关闭窗口，保存并重新上传当前版本的已校验清单';
		return;
	}
	aiInputBusy.value = true;
	aiInputError.value = '';
	try {
		await quoteApi.applyAiInputImport(aiInputTarget.value.id, aiInputTarget.value.revision, aiInputPreview.value.import_id);
		aiInputDialog.value = false;
		await loadQuote(aiInputTarget.value.id);
		ElMessage.success('已校验清单已更新到原草稿，请点击“人工核验完成”后再试算');
	} catch (error) {
		const detail = error as { msg?: string; message?: string };
		aiInputError.value = detail?.msg || detail?.message || '更新草稿失败，请刷新草稿后重新上传';
		if (!aiInputDialog.value) report(error);
	} finally {
		aiInputBusy.value = false;
	}
}
async function downloadAiSource(index: number, filename: string) {
	if (!quote.value) return;
	try {
		await quoteApi.downloadAiSource(quote.value.id, index, filename);
	} catch (error) {
		report(error);
	}
}
async function autoClassify() {
	if (!quote.value || locked.value) return;
	if (dirty.value && !(await save(false))) return;
	busy.value = true;
	try {
		const result = await quoteApi.autoClassify(quote.value.id, quote.value.revision);
		await loadQuote(quote.value.id);
		ElMessage.success(
			`已重新识别：风管 ${result.counts.duct} 项、设备 ${result.counts.equipment} 项、待识别 ${result.counts.pending} 项。请核对条件后试算。`
		);
	} catch (error) {
		report(error);
	} finally {
		busy.value = false;
	}
}
async function revise() {
	if (!quote.value) return;
	try {
		await confirm('创建新的报价版本？未保存的修改不会带入新版本。');
		const result = await quoteApi.action(quote.value.id, quote.value.revision, 'revise');
		if (result.id) {
			baseline.value = JSON.stringify(quote.value.body);
			await navigate(result.id);
		}
	} catch (error) {
		report(error);
	}
}
async function exportQuote(kind: string) {
	if (!quote.value) return;
	try {
		if (kind === 'formal') await confirm('生成正式报价后，此版本将锁定。请确认客户、项目、计价条件与金额已核对。');
		else {
			const pending = quote.value.result?.pending_count || 0;
			await confirm(
				pending
					? `当前有 ${pending} 项待确认。校对版会用黄色标记，单价和金额留空，并只汇总已确定项目。确认导出？`
					: '将按正式报价样式导出可编辑校对版，报价状态不会锁定。确认导出？'
			);
		}
		busy.value = true;
		const file = await quoteApi.export(quote.value.id, quote.value.revision, kind);
		await loadQuote(quote.value.id);
		await quoteApi.download(file.id, file.filename);
	} catch (error) {
		report(error);
	} finally {
		busy.value = false;
	}
}

function chooseReviewFile() {
	if (!quote.value || !exportable.value || locked.value) return;
	reviewFile.value?.click();
}

async function previewReviewFile(event: Event) {
	const input = event.target as HTMLInputElement,
		file = input.files?.[0];
	input.value = '';
	if (!file || !quote.value) return;
	busy.value = true;
	try {
		reviewPreview.value = await quoteApi.previewReviewImport(quote.value.id, quote.value.revision, file);
		reviewDialog.value = true;
	} catch (error) {
		report(error);
	} finally {
		busy.value = false;
	}
}

async function applyReviewFile() {
	if (!quote.value || !reviewPreview.value?.change_count) return;
	busy.value = true;
	try {
		await quoteApi.applyReviewImport(quote.value.id, quote.value.revision, reviewPreview.value.import_id);
		reviewDialog.value = false;
		await loadQuote(quote.value.id);
		ElMessage.success(quote.value.result?.formal_ready ? '人工报价已回导，可以生成正式报价' : '人工报价已回导，仍有项目需要确认');
	} catch (error) {
		report(error);
	} finally {
		busy.value = false;
	}
}

async function download(item: ExportRecord) {
	try {
		await quoteApi.download(item.id, item.filename);
	} catch (error) {
		report(error);
	}
}
async function leave() {
	if (!dirty.value) return true;
	try {
		await confirm('有未保存的修改，确定离开并放弃这些修改？');
		return true;
	} catch {
		return false;
	}
}
async function back() {
	await router.push('/quotation/workbench/index');
}
function beforeUnload(event: BeforeUnloadEvent) {
	if (dirty.value) {
		event.preventDefault();
		event.returnValue = '';
	}
}
onBeforeRouteLeave(leave);
onBeforeRouteUpdate(async (to, from) => to.query.id === from.query.id || (await leave()));
watch(() => route.query.id, initialize);
onMounted(() => {
	initialize();
	window.addEventListener('beforeunload', beforeUnload);
});
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload));
</script>

<style scoped>
.ai-input-changes {
	margin-top: 12px;
}
.ai-input-value {
	white-space: pre-wrap;
	word-break: break-word;
}
.material-status-cell {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 7px;
	line-height: 1.55;
}
.material-status-cell small {
	display: block;
	width: 100%;
	color: var(--el-text-color-secondary);
}
.drawer-installation {
	margin: 22px 0;
	padding-top: 18px;
	border-top: 1px solid var(--el-border-color-lighter);
}
.drawer-section-heading {
	display: flex;
	align-items: center;
	gap: 10px;
}
.drawer-section-heading h2 {
	margin: 0;
}
.drawer-subheading {
	display: flex;
	align-items: baseline;
	gap: 10px;
	padding-top: 6px;
	border-top: 1px solid var(--el-border-color-lighter);
}
.drawer-subheading h3,
.fan-selection h3 {
	margin: 0;
}
.drawer-subheading span {
	color: var(--el-text-color-secondary);
	font-size: 13px;
}
.fan-selection {
	padding: 16px 0;
	border-top: 1px solid var(--el-border-color-lighter);
	border-bottom: 1px solid var(--el-border-color-lighter);
}
.fan-selection-name {
	display: block;
	margin: 14px 0 10px;
	font-size: 18px;
	color: var(--el-text-color-primary);
}
.fan-selection-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 10px 18px;
}
.fan-selection-grid div {
	display: flex;
	justify-content: space-between;
	gap: 12px;
	padding-bottom: 7px;
	border-bottom: 1px dashed var(--el-border-color-lighter);
}
.fan-selection-grid span {
	color: var(--el-text-color-secondary);
}
.fan-selection-grid strong {
	text-align: right;
}
.fan-selection-note {
	margin: 12px 0 0;
	color: var(--el-text-color-regular);
}
.fan-candidates {
	display: grid;
	gap: 10px;
	margin: 12px 0;
}
:deep(.fan-candidates .el-radio) {
	height: auto;
	margin: 0;
	white-space: normal;
	line-height: 1.55;
}
@media (max-width: 680px) {
	.fan-selection-grid {
		grid-template-columns: 1fr;
	}
}
</style>
