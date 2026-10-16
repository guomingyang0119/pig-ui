<template>
	<main class="quotation-page" v-loading="busy">
		<!-- 报价工作台主页面：维护客户清单与整单条件，协调导入、逐行规则、安装、人工核验、保存试算及草稿/正式导出。金额与正式可导出状态以服务端结果为准。 -->
		<template v-if="!quote">
			<header class="q-header">
				<div>
					<h1>报价工作台</h1>
					<p class="q-subtitle">导入客户清单，逐行识别材料与设备，匹配规则计算并汇总报价。</p>
				</div>
				<div class="q-toolbar" v-if="canEdit">
					<el-badge is-dot :hidden="!hasDraftProductRules">
						<el-button :title="productRulesNotice" :aria-label="productRulesNotice" @click="productRuleDialog?.open()">产品规则管理</el-button>
					</el-badge>
					<el-button @click="createBlank()">新建报价</el-button>
					<el-button @click="aiImportDialog?.open()">AI整理资料并建草稿</el-button>
					<el-button type="primary" @click="importDialog?.open()">导入客户清单</el-button>
				</div>
			</header>
			<el-alert
				v-if="catalogsLoaded && !activeCatalog && !activeEquipment && !failed"
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
					<el-button v-if="!locked" @click="save(false)" :loading="saving" :disabled="reviewingAi">保存草稿</el-button>
					<el-button v-if="quote.body.excel_parameter_review" @click="excelResultDialog = true">查看最近一次Excel试算结果</el-button>
					<el-button v-if="!locked && quote.body.ai_review_status" type="primary" @click="approveAi" :loading="reviewingAi" :disabled="saving">
						{{ aiReviewRequired ? '核验完成并试算' : '重新试算' }}
					</el-button>
					<el-button v-else-if="!locked" type="primary" @click="save(true)" :loading="saving">保存并试算</el-button>
				</div>
			</header>
			<el-alert
				v-if="aiReviewRequired"
				type="warning"
				:closable="false"
				show-icon
				:title="`${dirty ? '报价内容已修改，需要重新人工核验。' : 'AI清单待人工核验。'}${
					aiUnknownNameCount ? `有 ${aiUnknownNameCount} 行产品名称待识别。` : ''
				}请对照客户资料逐行核对，可在页面修改或导回已校验清单。完成后点击“核验完成并试算”，系统会保存修改、记录核验并试算。`"
			/>
			<el-alert
				v-if="quote.body.ai_reused_from"
				type="info"
				:closable="false"
				:title="`已采用同一份原文件中此前核验的 ${quote.body.ai_reused_from.row_count} 行产品输入。请核对本次内容与报价条件，重新核验并试算。`"
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
				title="运算规则已更新，当前结果不能继续导出，请重新试算。"
			/>
			<el-alert v-if="isAuto && hasDuctRows && !activeCatalog" type="warning" :closable="false" title="清单含风管，需先核对并发布风管指标。" />
			<section class="q-section">
				<el-form label-position="top" :disabled="locked" class="q-grid" @submit.prevent>
					<el-form-item label="客户名称"><el-input v-model="quote.body.customer" placeholder="填写客户名称" /></el-form-item>
					<el-form-item label="项目名称"><el-input v-model="quote.body.project" placeholder="填写工程项目" /></el-form-item>
					<el-form-item label="项目所在省份 · 必选">
						<el-select v-model="quote.body.project_region" filterable clearable placeholder="请选择本项目所在省份" @change="projectProvinceChanged">
							<el-option v-for="province in projectProvinces" :key="province" :value="province" :label="province" />
						</el-select>
					</el-form-item>
					<el-form-item label="联系人 / 电话"><el-input v-model="quote.body.contact" /></el-form-item>
					<el-form-item label="报价日期"><el-date-picker v-model="quote.body.quote_date" value-format="YYYY-MM-DD" type="date" /></el-form-item>
					<el-form-item label="详细送货地址"><el-input v-model="quote.body.delivery_location" /></el-form-item>
					<el-form-item label="报价备注（会进入客户文件）" style="grid-column: span 2"
						><el-input v-model="quote.body.note" type="textarea" :rows="1" maxlength="1000"
					/></el-form-item>
				</el-form>
				<p class="q-muted">项目省份统一用于地区材料成本和安装计价；运费默认按此省份计算，是否安装、是否含运费仍按整单选择。</p>
				<el-alert v-if="legacyRegionConflict(quote.body)" :title="legacyRegionConflict(quote.body)" type="warning" :closable="false" />
				<p v-if="!locked && !quote.body.project_region_confirmed && quote.body.project_region_suggestions?.length" class="q-muted">
					资料中出现省份：{{ quote.body.project_region_suggestions.join('、') }}，请核对项目所在地。
					<el-button v-if="quote.body.project_region_suggestions.length === 1" link type="primary" @click="acceptSuggestedProvince">确认采用 {{ quote.body.project_region_suggestions[0] }}</el-button>
				</p>
				<el-button v-if="!locked && quote.body.project_region && !quote.body.project_region_confirmed" link type="primary" @click="projectProvinceChanged">确认项目省份为 {{ quote.body.project_region }}</el-button>
				<div v-if="!locked" class="q-toolbar">
					<el-checkbox v-model="quote.body.different_delivery_region" @change="deliveryProvinceChanged">送货地与项目所在地不同</el-checkbox>
					<el-select v-if="quote.body.different_delivery_region" v-model="quote.body.delivery_region" filterable clearable style="width: 240px" placeholder="请选择实际送货省份" aria-label="实际送货省份" @change="deliveryProvinceChanged">
						<el-option v-for="province in projectProvinces" :key="province" :value="province" :label="province" />
					</el-select>
				</div>
				<p v-else-if="quote.body.different_delivery_region" class="q-muted">实际送货省份：{{ quote.body.delivery_region }}</p>
				<el-alert v-if="quote.body.region_prices_confirmed === false" title="地区已改变，原人工价格及运费已保留，请核对后确认；重新试算将重新判断整单 8000 元运费门槛。" type="warning" :closable="false">
					<el-checkbox v-if="!locked" v-model="quote.body.region_prices_confirmed">已核对人工价格和运费，按当前地区继续试算</el-checkbox>
				</el-alert>
				<el-collapse v-if="quote.body.region_manual_review_snapshot">
					<el-collapse-item title="查看地区变更前的 Excel 人工报价" name="previous-manual-prices">
						<p class="q-muted">来源：{{ quote.body.region_manual_review_snapshot.filename }}。以下原价格保留供核对，不会自动覆盖新地区的试算结果；如需采用人工报价，请重新导出校对版填写并导回。</p>
						<el-table :data="(quote.body.region_manual_review_snapshot.lines || []).slice((manualRegionPage - 1) * 20, manualRegionPage * 20)">
							<el-table-column prop="name" label="产品" /><el-table-column prop="quantity" label="数量" />
							<el-table-column prop="material_unit" label="原材料单价" /><el-table-column prop="material_amount" label="原材料金额" />
							<el-table-column prop="installation_amount" label="原安装金额" />
						</el-table>
						<el-pagination v-model:current-page="manualRegionPage" :page-size="20" :total="quote.body.region_manual_review_snapshot.lines?.length || 0" layout="prev, pager, next, total" />
					</el-collapse-item>
				</el-collapse>
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
							<el-form-item label="共板角码数量（个）"><el-input v-model="options.corner_count" :disabled="options.accessory_review?.some(g => g.key === 'corner_count')" placeholder="未提供则留空" /></el-form-item>
							<el-form-item label="共板卡扣长度（米）"><el-input v-model="options.clip_meters" :disabled="options.accessory_review?.some(g => g.key === 'clip_meters')" placeholder="未提供则留空" /></el-form-item>
							<el-form-item label="整单 30# 角钢实际米数"><el-input v-model="options.flange_30_meters" :disabled="options.accessory_review?.some(g => g.key === 'flange_30_meters')" placeholder="未提供则留空" /></el-form-item>
							<el-form-item label="整单 40# 角钢实际米数"><el-input v-model="options.flange_40_meters" :disabled="options.accessory_review?.some(g => g.key === 'flange_40_meters')" placeholder="未提供则留空" /></el-form-item>
						</el-form>
						<p class="q-muted">整单角钢米数与本行角钢米数不能同时填写。共板半成品配件两项都留空时按面积取费；填写后仅按实际填写项计费。</p>
						<p v-if="options.accessory_review?.length" class="q-muted">同类配件的数量由下方“同类配件核对”区确定，此处不可重复填写。</p>
					</details>
				</el-collapse-item>
			</el-collapse>
			<AccessoryReviewPanel :options="options" :locked="locked" :dirty="dirty" />
			<InstallationPanel
				id="quote-installation-conditions"
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
						<el-badge is-dot :hidden="!hasDraftProductRules">
							<el-button :title="productRulesNotice" :aria-label="productRulesNotice" @click="productRuleDialog?.open()">产品规则管理</el-button>
						</el-badge>
						<el-button @click="autoClassify">重新识别清单</el-button>
						<el-button :disabled="!batchRows.length" @click="batchParameterDialog?.open()">批量补充（{{ batchRows.length }} 项）</el-button>
						<el-button :disabled="dirty || busy || saving || !failedAssistTargets.length" @click="aiRetryDialog?.open()">AI辅助识别失败项目（{{ failedAssistTargets.length }}）</el-button>
						<el-button :disabled="!batchRows.length" @click="scopeDialog?.open(batchRows)">批量设置范围</el-button>
						<el-button @click="addRow">＋ 添加项目</el-button>
					</div>
					<el-button v-if="quote.body.ai_retry_report" :disabled="busy || saving" @click="aiRetryDialog?.open(true)">查看最近一次AI辅助结果</el-button>
				</div>
				<el-alert v-if="quote.result && !dirty && !quote.result_stale && failedSupplyCount" type="warning" :closable="false"
					:title="`${failedSupplyCount} 项供货报价未完成，其中 ${failedAssistTargets.length} 项可尝试AI辅助识别；其余项目需补资料、确认规则或人工处理。`">
					<p>是否使用AI辅助识别？点击上方按钮后才会调用，已成功报价的项目不参与。</p>
				</el-alert>
				<div class="q-toolbar" style="margin: 12px 0">
					<span>总数 {{ scopeCounts.total }}</span><span>参与 {{ scopeCounts.participating }}（含仅安装）</span>
					<span>已完成 {{ scopeCounts.completed }}</span><span>未完成 {{ scopeCounts.pending }}</span><span>不报价 {{ scopeCounts.excluded }}</span>
					<span v-if="dirty || hasModifiedRows" class="q-muted">有修改，完成状态待重新试算</span>
				</div>
				<div class="q-toolbar" style="margin-bottom: 12px">
					<el-input v-model="productSearch" clearable placeholder="搜索产品、规格、来源或原因" style="width: 260px" />
					<el-select v-model="productCategory" clearable placeholder="全部类别" style="width: 150px">
						<el-option v-for="category in productCategories" :key="category" :value="category" :label="category" />
					</el-select>
					<el-checkbox v-model="onlyReviewRows">仅看待核对 / 待确认行</el-checkbox>
					<el-select v-model="importIssueKind" clearable placeholder="全部导入问题" style="width: 160px">
						<el-option v-for="(label, key) in importIssueLabels" :key="key" :value="key" :label="label" />
					</el-select>
					<span v-if="!locked">已选 {{ batchRows.length }} 项（跨页保留）</span>
					<el-button v-if="batchRows.length" link @click="selectedRowIds = []">清空选择</el-button>
				</div>
				<p v-if="missingRowIdCount && !locked" class="q-muted">{{ missingRowIdCount }} 行缺少历史行标识，请逐行设置范围；这些行暂不支持批量选择。</p>
				<p v-if="!locked" class="q-muted">普通导入不调用AI。仅需辅助理解歧义时选择明细后使用；有修改请先保存。</p>
				<el-table
					ref="productTable"
					:data="visibleProductRows"
					:row-key="productRowKey"
					class="q-table"
					max-height="450"
					:row-class-name="rowClass"
					@row-dblclick="openRow"
				>
					<el-table-column v-if="!locked" width="45">
						<template #header><el-checkbox :model-value="allVisibleSelected" :disabled="!selectableVisibleRows.length" :indeterminate="someVisibleSelected && !allVisibleSelected" aria-label="选择当前页" @change="togglePageSelection" /></template>
						<template #default="{ row }"><el-checkbox :model-value="selectedRowIds.includes(row.row_id)" :disabled="!row.row_id" :aria-label="`选择 ${row.name}`" @change="(checked) => toggleRowSelection(row, checked)" /></template>
					</el-table-column>
					<el-table-column type="index" :index="visibleRowNumber" label="#" width="48" />
					<el-table-column v-if="hasSourceRows" label="原表来源" min-width="175">
						<template #default="{ row }">
							<el-tooltip :content="customerSourceLabel(row)" placement="top"
								><el-button link type="primary" @click="openSource(originalIndex(row))">{{ customerSourceLabel(row) }}</el-button></el-tooltip
							>
						</template>
					</el-table-column>
					<el-table-column label="产品名称" min-width="170"
						><template #default="{ row }"><el-input v-model="row.name" :disabled="locked" placeholder="产品名称" /></template
					></el-table-column>
					<el-table-column label="报价范围" min-width="165">
						<template #default="{ row }">
							<div class="material-status-cell">
								<el-tag :type="row.excluded ? 'info' : row.installation_only ? 'warning' : 'success'" effect="plain" size="small">{{ quoteScopeLabel(row) }}</el-tag>
								<small v-if="row.excluded">{{ row.exclude_reason }}</small>
								<el-button v-if="!locked" link type="primary" @click="scopeDialog?.open([row])">设置范围</el-button>
							</div>
						</template>
					</el-table-column>
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
						><template #default="{ row }"
							><div class="material-status-cell">
								<template v-if="row.excluded">
									<el-tag type="info" effect="plain" size="small">不报价</el-tag><span>{{ row.exclude_reason }}</span>
								</template>
								<template v-else-if="rowModified(originalIndex(row))">
									<el-tag type="warning" effect="light" size="small">已修改，待试算</el-tag>
									<span>可继续修改其他项目，最后统一保存并试算</span>
									<small v-if="previousPendingReason(originalIndex(row))" class="q-muted">上次待确认：{{ previousPendingReason(originalIndex(row)) }}</small>
								</template>
								<template v-else-if="row.installation_only">
									<el-tag type="info" effect="plain" size="small">不含材料</el-tag><span>仅参与安装报价</span>
								</template>
								<template v-else-if="dirty || ((!quote.result || quote.result_stale) && rowAttention(originalIndex(row)) === 'pending')">
									<el-tag :type="rowAttention(originalIndex(row)) === 'pending' ? 'warning' : 'info'" effect="light" size="small">
										{{ rowAttention(originalIndex(row)) === 'pending' ? '上次试算待确认' : '等待重新试算' }}
									</el-tag>
									<span>{{ previousPendingReason(originalIndex(row)) || '保存并试算后刷新本行结果' }}</span>
								</template>
								<template v-else-if="quote.result?.rows[originalIndex(row)]?.status === 'priced'">
									<el-tag type="success" effect="light" size="small">已计算</el-tag>
									<span>{{ materialSummary(originalIndex(row)) }}</span>
									<small v-if="materialExtraSummary(originalIndex(row))">{{ materialExtraSummary(originalIndex(row)) }}</small>
								</template>
								<template v-else-if="quote.result?.rows[originalIndex(row)]?.status === 'pending'">
									<el-tag type="danger" effect="dark" size="small">待确认</el-tag>
									<span class="q-error">{{ quote.result?.rows[originalIndex(row)]?.reason }}</span>
								</template>
								<template v-else-if="quote.result?.rows[originalIndex(row)]?.status === 'excluded'">
									<el-tag type="info" effect="plain" size="small">不报价</el-tag>
									<span>{{ quote.result?.rows[originalIndex(row)]?.reason }}</span>
								</template>
								<template v-else>
									<el-tag :type="rowAttention(originalIndex(row)) === 'review' ? 'warning' : 'info'" effect="plain" size="small">
										{{ rowAttention(originalIndex(row)) === 'review' ? '待核对' : '等待试算' }}
									</el-tag>
									<span>{{
										rowAttention(originalIndex(row)) === 'review'
											? rowReviewReason(originalIndex(row)) || (!row.source_issue_confirmed && row.source_issue_reason) || '请核对清单信息及安装条件'
											: '保存并试算后查看结果'
									}}</span>
								</template>
								<small
									v-if="!row.excluded && (dirty || quote.result?.rows[originalIndex(row)] || row.installation_only) && currentAiConfidenceReason(row, quote.body.ai_review_status)"
									class="review-reminder"
								>
									{{ currentAiConfidenceReason(row, quote.body.ai_review_status) }}
								</small>
								<small v-if="currentAiCorrectionReason(row)" class="q-muted">系统纠正说明：{{ currentAiCorrectionReason(row) }}</small>
							</div></template
						></el-table-column
					>
					<el-table-column label="材料金额" width="130" align="right"
						><template #default="{ row }"
							><span v-if="row.excluded" class="q-muted">不报价</span
							><span v-else-if="row.installation_only" class="q-muted">不含材料</span
							><span v-else-if="dirty" class="q-muted">—</span
							><span v-else-if="quote.result?.rows[originalIndex(row)]?.status === 'priced'" class="q-number">{{
								money(quote.result?.rows[originalIndex(row)]?.amount, rowDigits(originalIndex(row)))
							}}</span
							><el-tag v-else-if="quote.result?.rows[originalIndex(row)]?.status === 'pending'" type="danger" effect="dark" size="small">待确认</el-tag
							><span v-else-if="quote.result?.rows[originalIndex(row)]?.status === 'excluded'" class="q-muted">不报价</span
							><span v-else class="q-muted">—</span></template
						></el-table-column
					>
					<el-table-column v-if="quote.body.installation_options?.included" label="安装费用" width="130" align="right">
						<template #default="{ row }">
							<span v-if="row.excluded" class="q-muted">不报价</span>
							<span v-else-if="dirty" class="q-muted">—</span>
							<el-tag v-else-if="quote.result?.rows[originalIndex(row)]?.installation_status === 'pending'" type="danger" effect="dark" size="small"
								>待确认</el-tag
							>
							<span v-else-if="quote.result?.rows[originalIndex(row)]?.installation_status === 'excluded'" class="q-muted">不含安装</span>
							<span v-else class="q-number">{{ money(quote.result?.rows[originalIndex(row)]?.installation_amount, 2) }}</span>
						</template>
					</el-table-column>
					<el-table-column v-if="quote.body.installation_options?.included" label="本行报价" width="130" align="right">
						<template #default="{ row }">
							<span v-if="row.excluded" class="q-muted">不报价</span
							><span v-else-if="dirty" class="q-muted">—</span
							><span v-else-if="quote.result?.rows[originalIndex(row)]?.line_total != null" class="q-number">{{
								money(quote.result?.rows[originalIndex(row)]?.line_total, 2)
							}}</span
							><el-tag
								v-else-if="rowNeedsAttention(originalIndex(row))"
								:type="rowAttention(originalIndex(row)) === 'pending' ? 'danger' : 'warning'"
								effect="light"
								size="small"
								>{{ rowAttention(originalIndex(row)) === 'pending' ? '待确认' : '待核对' }}</el-tag
							><span v-else class="q-muted">—</span></template
						></el-table-column
					>
					<el-table-column width="100" fixed="right"
						><template #default="{ row }"
							><div class="material-status-cell">
								<el-button
									v-if="!locked && !row.excluded && !row.installation_only && (!row.category || rowReviewResult(originalIndex(row))?.status === 'pending')"
									link
									type="primary"
									@click="openProductRule(row)"
								>
									匹配规则
								</el-button>
								<el-button
									:type="rowModified(originalIndex(row)) ? 'primary' : rowAttention(originalIndex(row)) === 'pending' ? 'danger' : rowAttention(originalIndex(row)) === 'review' ? 'warning' : 'primary'"
									link
									@click="openRow(row)"
								>
									{{
										rowModified(originalIndex(row)) ? '继续修改' : rowAttention(originalIndex(row)) === 'pending'
											? '立即处理'
											: rowAttention(originalIndex(row)) === 'review' ? '核对信息' : '参数 / 明细'
									}}
								</el-button>
							</div></template
						></el-table-column
					>
				</el-table>
				<el-pagination v-model:current-page="productPage" v-model:page-size="productPageSize" :page-sizes="[50, 100]" :total="filteredProductRows.length" layout="total, sizes, prev, pager, next, jumper" style="margin-top: 14px" />
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
				<el-alert
					v-if="dirty"
					:title="'内容有修改，下方为上次试算结果。请' + (quote.body.ai_review_status ? '核验完成并试算' : '保存并试算') + '后再导出。'"
					type="warning"
					:closable="false"
				/>
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
				<details v-if="quote.body.manual_review_snapshot" class="q-muted">
					<summary>查看已保留的人工报价（{{ quote.body.manual_review_snapshot.review.filename }}）</summary>
					<p>以下为上次人工确认的价格，供核对；重新试算后以当前结果为准。</p>
					<el-table :data="quote.body.manual_review_snapshot.lines" max-height="320">
						<el-table-column prop="name" label="产品" min-width="180" />
						<el-table-column prop="quantity" label="数量" />
						<el-table-column prop="material_unit" label="材料单价" />
						<el-table-column prop="material_amount" label="材料金额" />
						<el-table-column prop="installation_amount" label="安装费" />
					</el-table>
				</details>
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
									><strong class="q-number">{{ quote.result?.fees[key]?.status === 'pending' ? '待确认' : '¥ ' + money(quote.result?.fees[key]?.amount) }}</strong>
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
						><el-button :disabled="!exportable || !!exporting" :loading="exporting === 'draft'" @click="exportQuote('draft')">导出可编辑校对版</el-button
						><el-button :disabled="!exportable || locked" @click="chooseReviewFile">导入已完善校对版</el-button
						><el-button type="primary" :disabled="!exportable || !quote.result?.formal_ready || !!exporting" :loading="exporting === 'formal'" @click="exportQuote('formal')"
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
			@rules-changed="productRulesChanged"
		/>
		<SourceCompareDialog
			v-if="quote"
			ref="sourceCompareDialog"
			:rows="quote.body.rows"
			:ai-review-status="quote.body.ai_review_status"
			v-model:index="sourceIndex"
			@edit="openRow"
		/>
		<BatchParameterDialog ref="batchParameterDialog" :rows="batchRows" :locked="locked || busy || saving || reviewingAi" @applied="batchApplied" />
		<AiRetryDialog v-if="quote" ref="aiRetryDialog" :quote="quote" :rows="failedAssistTargets" :dirty="dirty" :locked="locked || busy || saving || reviewingAi" :apply-batch="applyAiRetryBatch" @report="receiveAiRetryReport" @locate="locateAiRetryRow" />
		<QuoteScopeDialog ref="scopeDialog" :installation-included="!!quote?.body.installation_options?.included" :locked="locked || busy || saving || reviewingAi" @applied="scopeApplied" @installation-setup="openInstallationSetup" />
		<input ref="reviewFile" type="file" accept=".xlsx" hidden @change="previewReviewFile" />
		<el-dialog v-model="reviewDialog" title="确认回导人工报价" width="min(1500px, 96vw)" top="4vh" class="review-import-dialog" destroy-on-close>
			<template v-if="reviewPreview">
				<el-alert v-if="reviewPreview.location_changed" type="warning" :closable="false" title="Excel 中的地址与系统不同，本次导回不会改变项目省份或送货地址。需要更改时，请返回工作台修改后重新试算。">
					<p>Excel：{{ reviewPreview.location_text || '空白' }}</p><p>系统：{{ reviewPreview.system_location }}</p>
					<el-checkbox v-model="keepSystemLocation">已核对差异，保留系统地址继续导回</el-checkbox>
				</el-alert>
				<section v-if="reviewPreview.scope_restorations?.length" class="review-import-section">
					<el-alert title="以下填价会恢复参与供货报价，请逐项明确确认" description="预览合计仍按原报价范围计算。全部勾选后才能回导；如不恢复，请取消并修改校对文件后重新上传。" type="warning" :closable="false" />
					<p class="q-muted">安装请填写安装金额；仅填安装单价不会生成报价。</p>
					<el-checkbox-group v-model="restoreScopeRowIds">
						<div v-for="item in reviewPreview.scope_restorations" :key="item.source_row_id">
							<el-checkbox :label="item.source_row_id">{{ item.name }}：{{ item.previous_scope === 'excluded' ? '不报价' : '仅安装' }} → 参与供货报价</el-checkbox>
						</div>
					</el-checkbox-group>
				</section>
				<el-alert
					:title="
						reviewPreview.input_recalculated
							? `已按修改后的参数预试算，仍有 ${reviewPreview.pending_count} 项待确认。确认导回后统一保存参数并重新试算。`
							: reviewPreview.pending_count
							? `仍有 ${reviewPreview.pending_count} 行价格未补全，回导后仍不能生成正式报价。`
							: `共识别 ${reviewPreview.change_count} 处修改，回导后付款前合计为 ${money(reviewPreview.before_payment_total)} 元。`
					"
					:type="reviewPreview.pending_count ? 'warning' : 'success'"
					:closable="false"
				/>
				<ExcelReviewResults v-if="reviewPreview.input_recalculated" :rows="reviewPreview.input_results || []" @locate="locateExcelRow" />
				<p v-if="reviewPreview.input_recalculated" class="q-muted">{{ reviewPreview.calculation_issues?.join('；') }}</p>
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

				<section v-if="changedReviewRows.length && !reviewPreview.input_recalculated" class="review-import-section">
					<div class="review-import-heading">
						<h3>已修改产品</h3>
						<span>修改后的值加粗显示，下面保留原值；蓝色项目由系统根据数量补算。</span>
					</div>
					<ReviewImportTable :rows="changedReviewRows" :installation="reviewPreview.column_count === 12" />
				</section>

				<section v-if="pendingReviewRows.length && !reviewPreview.input_recalculated" class="review-import-section pending">
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
				<el-button type="primary" :disabled="!reviewPreview?.change_count || !allScopeRestorationsConfirmed || (reviewPreview.location_changed && !keepSystemLocation)" @click="applyReviewFile"
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
					:title="`共 ${aiInputPreview.product_row_count} 条明细、${aiInputPreview.special_row_count} 条汇总或备注，修改了 ${aiInputPreview.changed_row_count} 行、${aiInputPreview.change_count} 个字段。确认后统一更新参数、记录人工核验并重新试算。`"
					type="warning"
					:closable="false"
					show-icon
				/>
				<p class="q-muted">
					主表右侧“报价参数（可修改）”按“字段：值”修改；名称、规格、厚度、法兰、单位、数量和备注直接修改原列。原表位置和待处理原因仅供查看。请保留整份文件，不增删或排序产品行，金额由系统统一试算。
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
					没有发现内容修改，可以关闭此窗口{{ aiReviewRequired ? '，继续在草稿中点击“核验完成并试算”。' : '继续处理草稿。' }}
				</p>
			</template>
			<template #footer>
				<el-button :disabled="aiInputBusy" @click="aiInputDialog = false">取消</el-button>
				<el-button type="primary" :loading="aiInputBusy" :disabled="!aiInputPreview?.change_count || !!aiInputError" @click="applyAiInputFile">
					确认核验并统一试算
				</el-button>
			</template>
		</el-dialog>
		<el-dialog v-model="excelResultDialog" title="Excel参数回导 · 试算结果" width="min(1250px, 96vw)">
			<template v-if="quote?.body.excel_parameter_review">
				<p>{{ quote.body.excel_parameter_review.filename }} · {{ quote.body.excel_parameter_review.calculated_at }}（本次回导时的结果）</p>
				<ExcelReviewResults :rows="quote.body.excel_parameter_review.input_results" @locate="locateExcelRow" />
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
				<section v-if="selectedRow.import_review" class="q-section">
					<p v-if="selectedRow.import_review.section">所属章节：{{ selectedRow.import_review.section }}</p>
					<p v-if="selectedRow.import_review.dimension_expression">原尺寸区间：{{ selectedRow.import_review.dimension_expression }}</p>
					<p v-for="issue in selectedRow.import_review.issues" :key="issue.code" class="q-muted">{{ importIssueLabels[issue.kind] }}：{{ issue.message }}</p>
				</section>
				<el-alert
					v-if="currentAiCorrectionReason(selectedRow)"
					title="系统纠正说明"
					:description="currentAiCorrectionReason(selectedRow)"
					type="info"
					:closable="false"
					show-icon
					style="margin-bottom: 14px"
				/>
				<el-alert
					v-if="!selectedRow.excluded && (selectedResult?.reason || rowReviewReason(selected))"
					:title="[selectedResult?.reason, rowReviewReason(selected)].filter(Boolean).join('；')"
					:description="selectedConfidenceReason ? aiConfidenceDetails(selectedRow) : undefined"
					:type="selectedConfidenceReason ? 'error' : 'warning'"
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
					<el-form-item v-for="field in rowProductDescriptionFields(selectedRow)" :key="field.key" :label="field.label" class="q-wide">
						<el-input v-model="selectedRow.attributes[field.key]" type="textarea" />
					</el-form-item>
					<p v-if="equipmentKindSourceLabel(selectedRow.attributes.equipment_kind_source)" class="q-muted q-wide">
						计算类型来源：{{ equipmentKindSourceLabel(selectedRow.attributes.equipment_kind_source) }}
					</p>
					<el-form-item v-if="!selectedEquipment" label="工程量总面积（㎡）"><el-input v-model="selectedRow.engineering_quantity" /></el-form-item>
					<template v-else>
						<el-form-item label="设备数量"><el-input v-model="selectedRow.quantity" /></el-form-item>
						<el-form-item label="客户单位"><el-input v-model="selectedRow.unit" placeholder="台 / 个 / ㎡" /></el-form-item>
						<p v-if="selectedRow.attributes.equipment_kind === 'plenum' || selectedRow.attributes.source_total_area" class="q-muted q-wide">
							静压箱按设备个数报价，单个成本由箱体展开面积计算。客户总面积只用于核对，不会再计一份费用。
						</p>
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
						<el-select
							v-if="field.choices"
							:model-value="equipmentParameterValue(selectedRow.attributes, field.key, selectedRow.attributes.equipment_kind || selectedRuleBody?.attributes.equipment_kind, selectedRuleBody?.canonical_name || selectedRow.name)"
							clearable
							placeholder="按清单 / 整单条件"
							@update:model-value="updateRowParameter(selectedRow, field.key, $event, selectedRow.attributes.equipment_kind || selectedRuleBody?.attributes.equipment_kind, selectedRuleBody?.canonical_name || selectedRow.name)"
						>
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
					<section v-if="selectedResult?.equipment_kind === 'purchased' && selectedResult.candidates?.length" class="fan-selection q-wide">
						<h3>换气扇候选型号</h3>
						<p class="q-error">{{ selectedResult.reason }}</p>
						<el-radio-group v-model="selectedRow.candidate_id" :disabled="locked" aria-label="换气扇候选" class="fan-candidates">
							<el-radio v-for="candidate in selectedResult.candidates" :key="candidate.id" :label="candidate.id">
								{{ candidate.body.attributes.name }} / {{ candidate.body.name }}；风量 {{ fanParameterRange(candidate.body.attributes, 'airflow') }} m³/h；功率 {{ candidate.body.attributes.power || '未提供' }}{{ candidate.body.attributes.power ? ' W' : '' }}
							</el-radio>
						</el-radio-group>
						<p class="q-muted">请选择确认采用的型号，保存并试算后计价。</p>
					</section>
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
									<span>风量</span><strong>{{ fanParameterRange(selectedFan, 'airflow') }} m³/h</strong>
								</div>
								<div>
									<span>风压</span><strong>{{ fanParameterRange(selectedFan, 'pressure') }} Pa</strong>
								</div>
								<div>
									<span>转速</span><strong>{{ selectedFan.speed || '—' }} r/min</strong>
								</div>
								<div v-if="selectedFan.airflow_low">
									<span>低速档风量</span><strong>{{ fanParameterRange(selectedFan, 'airflow_low') }} m³/h</strong>
								</div>
								<div v-if="selectedFan.pressure_low">
									<span>低速档风压</span><strong>{{ fanParameterRange(selectedFan, 'pressure_low') }} Pa</strong>
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
							<p class="q-error">{{ selectedResult.reason || `找到 ${selectedResult.candidates.length} 个候选风机，请核对参数并确认型号。` }}</p>
							<el-radio-group v-model="selectedRow.candidate_id" :disabled="locked" aria-label="风机候选" class="fan-candidates">
								<el-radio v-for="candidate in selectedResult.candidates" :key="candidate.id" :label="candidate.id" :disabled="!!candidate.body.attributes.requirement_mismatches">
									<strong>{{ candidate.body.name }}</strong
									>；机号 {{ candidate.body.attributes.size || '—' }}；功率 {{ candidate.body.attributes.powers.join('/') }} kW；风量
									{{ fanParameterRange(candidate.body.attributes, 'airflow') }} m³/h；风压 {{ fanParameterRange(candidate.body.attributes, 'pressure') }} Pa；转速
									{{ candidate.body.attributes.speed }} r/min
									<span v-if="candidate.body.attributes.requirement_mismatches" class="q-error">；参考型号，{{ candidate.body.attributes.requirement_mismatches }}</span>
								</el-radio>
							</el-radio-group>
							<p class="q-muted">符合条件的候选可选择后保存并重新试算。参考型号须先核实差异，并填写确认后的需求参数。</p>
						</template>
						<p v-else class="q-muted">{{ selectedResult?.reason || '保存并试算后，系统会在这里显示最终选中的风机及完整参数。' }}</p>
					</section>
					<el-form-item label="客户备注" class="q-wide"><el-input v-model="selectedRow.remark" type="textarea" /></el-form-item>
					<div class="q-wide">
						<el-tag effect="plain" :type="selectedRow.excluded ? 'info' : selectedRow.installation_only ? 'warning' : 'success'">{{ quoteScopeLabel(selectedRow) }}</el-tag>
						<el-button v-if="!locked" link type="primary" @click="scopeDialog?.open([selectedRow])">设置报价范围</el-button>
						<p v-if="selectedRow.excluded" class="q-muted">不报价原因：{{ selectedRow.exclude_reason }}</p>
						<p v-if="!selectedRow.excluded && selectedRow.source_issue_reason && !(selectedRow.diameter_review?.conflict && selectedRow.source_issue_confirmed)" class="q-error">{{ selectedRow.source_issue_reason }}</p>
						<SourceDiameterPanel :row="selectedRow" :review="selectedRow.diameter_review" :locked="locked" />
						<el-checkbox v-if="selectedRow.source_issue && !selectedRow.diameter_review?.conflict" v-model="selectedRow.source_issue_confirmed"
							>已核对原资料异常或参数冲突，并确认本次采用的数据</el-checkbox
						>
					</div>
				</el-form>
				<section v-if="!selectedRow.excluded && quote.body.installation_options?.included && selectedRow.installation" class="drawer-installation">
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
						客户来源：{{ selectedRow.original.source_file }} · {{ selectedRow.original.source_sheet?.trim() ? selectedRow.original.source_sheet : `空白表名（第 ${(selectedRow.original.source_sheet_index ?? 0) + 1} 个工作表）` }} {{ selectedRow.original.source_locator }}
					</p>
					<p v-if="selectedRow.attributes.position_tag" class="q-muted">原位号：{{ selectedRow.attributes.position_tag }}</p>
					<p v-if="selectedRow.attributes.dimension_expression" class="q-muted">原尺寸算式：{{ selectedRow.attributes.dimension_expression }}；面板附加高度：{{ selectedRow.attributes.panel_height || '—' }} mm</p>
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
								><code>用量 {{ component.effective_quantity ?? component.quantity }} × {{ component.price_basis === 'sale' ? '已定未税售价（不再加毛利）' : '未税成本' }} {{ component.price_basis === 'sale' ? component.unit_sale_price : component.unit_cost }} 元</code>
								<code v-if="mechanismCostExplanation(component.detail)">{{ mechanismCostExplanation(component.detail) }}</code>
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
							<code v-if="key === 'mechanism' && mechanismCostExplanation(selectedResult.detail)">{{ mechanismCostExplanation(selectedResult.detail) }}</code>
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
							>材料金额 <span>{{ selectedRow.excluded ? '不报价' : selectedRow.installation_only ? '不含材料' : money(selectedResult.amount, rowDigits(selected)) }}</span></strong
						>
					</div>
					<div v-if="quote.body.installation_options?.included" class="q-trace">
						<strong
							>安装费用
							<span>{{ selectedRow.excluded ? '不报价' : selectedResult.installation_status === 'pending' ? '待确认' : money(selectedResult.installation_amount, 2) }}</span></strong
						>
						<code v-if="selectedResult.installation_reason">{{ selectedResult.installation_reason }}</code>
					</div>
					<div v-if="quote.body.installation_options?.included" class="q-trace">
						<strong
							>本行报价 <span>{{ selectedRow.excluded ? '不报价' : money(selectedResult.line_total, 2) }}</span></strong
						>
					</div>
				</section>
			</div>
			<template #footer><el-button @click="drawer = false">完成核对</el-button></template>
		</el-drawer>
	</main>
</template>
<script setup lang="ts" name="QuotationWorkbench">
/** 报价工作台主页面：维护客户清单与整单条件，协调导入、逐行规则、安装、人工核验、保存试算及草稿/正式导出。金额与正式可导出状态以服务端结果为准。 */
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import type { AiRetryReport } from '/@/types/quotation';
import type { ComputedRef } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';
import { ElMessage } from 'element-plus';
import { auth } from '/@/utils/authFunction';
import { quoteApi } from '/@/api/quotation';
import type { QuoteMutationResult } from '/@/api/quotation';
import { money, stateLabels, report, confirm, blankRow, rowFields, flangeTypes, shapes, productStates } from '/@/views/quotation/shared';
import type { Catalog, Quote, QuoteRow, ExportRecord, InstallationCatalogBody, ReviewImportPreview, AiInputImportPreview, ProductRuleBody } from '/@/types/quotation';
import ProductRuleDialog from './ProductRuleDialog.vue';
import SourceCompareDialog from './SourceCompareDialog.vue';
import AiRetryDialog from './AiRetryDialog.vue';
import { failedAssistRows } from './failedQuoteAssist';
import { importIssueLabels } from './importReview';
import BatchParameterDialog from './BatchParameterDialog.vue';
import QuoteScopeDialog from './QuoteScopeDialog.vue';
import { filterQuoteRows, pageQuoteRows, quoteScopeCounts, quoteScopeLabel, selectPageRows, selectedQuoteRows, scopeRestorationsConfirmed, scopePaymentTerms } from './quoteScope';
import { customerSourceLabel } from './batchParameters';
import { previousRowReview, reviewRowModified, updateReviewSnapshot } from './pendingReview';
import type { ReviewSnapshot } from './pendingReview';
import { createQuoteEditState } from './quoteEditState';
import {
	aiConfidenceDetails,
	currentAiConfidenceReason,
	currentAiCorrectionReason,
	currentReviewReason,
	equipmentKindSourceLabel,
	rowAttentionState,
	rowProductDescriptionFields,
	updateRowParameter,
} from './rowReview';
import InstallationPanel from './InstallationPanel.vue';
import ExcelReviewResults from './ExcelReviewResults.vue';
import AccessoryReviewPanel from './AccessoryReviewPanel.vue';
import SourceDiameterPanel from './SourceDiameterPanel.vue';
import InstallationEntryFields from './InstallationEntryFields.vue';
import ReviewImportTable from './ReviewImportTable.vue';
import { prepareInstallation, blankInstallation } from '/@/views/quotation/installation';
import { prepareProjectRegion, syncProjectRegion, projectRegionIssue, projectProvinces, legacyRegionConflict, hasManualRegionPrices } from './projectRegion';
const keepSystemLocation = ref(false);
const regionNeedsSave = ref(false);
const manualRegionPage = ref(1);
import QuoteList from '/@/views/quotation/QuoteList.vue';
import ImportDialog from '/@/views/quotation/ImportDialog.vue';
import AiImportDialog from '/@/views/quotation/AiImportDialog.vue';
import '/@/views/quotation/quotation.scss';
import { equipmentCategories, equipmentFields, equipmentFieldsFor, equipmentComponents, equipmentParameterValue, mechanismCostExplanation } from '/@/views/quotation/equipment';
const route = useRoute(),
	router = useRouter();
/** quote 保存当前报价版本及上次计算结果；busy/saving 区分一般请求与保存过程。 */
const quote = ref<Quote>(),
	catalogs = ref<Catalog[]>([]),
	busy = ref(false),
	exporting = ref(''),
	saving = ref(false),
	reviewingAi = ref(false),
	failed = ref(false);
const reviewSnapshot = ref<ReviewSnapshot>();
const rowModifications = new WeakMap<QuoteRow, ComputedRef<boolean>>();
/** 普通导入、AI 导入和产品规则组件通过引用打开；两类回导各自保存预览，AI 回导另绑定目标报价 ID 与修订号。 */
const importDialog = ref<InstanceType<typeof ImportDialog>>(),
	aiImportDialog = ref<InstanceType<typeof AiImportDialog>>(),
	productRuleDialog = ref<InstanceType<typeof ProductRuleDialog>>(),
	productRules = ref<Catalog<ProductRuleBody>[]>([]),
	productRulesLoadState = ref<'idle' | 'loading' | 'ready' | 'error'>('idle'),
	reviewFile = ref<HTMLInputElement>(),
	reviewDialog = ref(false),
	excelResultDialog = ref(false),
	reviewPreview = ref<ReviewImportPreview>(),
	restoreScopeRowIds = ref<string[]>([]),
	aiInputFile = ref<HTMLInputElement>(),
	aiInputDialog = ref(false),
	aiInputBusy = ref(false),
	aiInputPreview = ref<AiInputImportPreview>(),
	aiInputTarget = ref<{ id: string; revision: number }>(),
	aiInputFilename = ref(''),
	aiInputError = ref(''),
	drawer = ref(false),
	selected = ref(0),
	onlyReviewRows = ref(false),
	productSearch = ref(''),
	productCategory = ref(''),
	productPage = ref(1),
	productPageSize = ref(50),
	sections = ref(['conditions']);
const hasDraftProductRules = computed(() => productRules.value.some((rule) => rule.status === 'draft'));
const productRulesNotice = computed(() => {
	if (productRulesLoadState.value === 'idle') return '产品规则管理：点击查看规则及待处理草稿。';
	if (productRulesLoadState.value === 'error')
		return hasDraftProductRules.value
			? '产品规则管理：规则状态刷新失败，仍有已知待处理草稿，请重新加载。'
			: '产品规则管理：规则状态刷新失败，草稿状态未知，请重新加载。';
	if (productRulesLoadState.value === 'loading')
		return hasDraftProductRules.value ? '产品规则管理：正在刷新，仍有已知待处理草稿。' : '产品规则管理：正在读取规则状态。';
	return hasDraftProductRules.value
		? '产品规则管理：有待处理草稿（含未发布修订），请核对并发布。'
		: '产品规则管理：当前可见规则没有待处理草稿。';
});
let productRulesRequest = 0;
let quoteLoadRequest = 0;
let initializeRequest = 0;
/** 编辑与导出按钮分别检查账号权限；只有草稿可编辑，已定稿或归档版本通过修订继续处理。 */
const canEdit = computed(() => auth('quote_edit')),
	canExport = computed(() => auth('quote_export'));
const locked = computed(() => !canEdit.value || quote.value?.state !== 'draft');
const sourceCompareDialog = ref<InstanceType<typeof SourceCompareDialog>>(),
	batchParameterDialog = ref<InstanceType<typeof BatchParameterDialog>>(),
	scopeDialog = ref<InstanceType<typeof QuoteScopeDialog>>(),
	sourceIndex = ref(0),
	selectedRowIds = ref<string[]>([]);
const batchRows = computed(() => selectedQuoteRows(quote.value?.body.rows || [], selectedRowIds.value));
const aiRetryDialog = ref<InstanceType<typeof AiRetryDialog>>();
const failedAssistTargets = computed(() => quote.value?.result_stale ? [] : failedAssistRows(quote.value?.body.rows || [], quote.value?.result?.rows || []));
const failedSupplyCount = computed(() => quote.value?.result?.rows.filter(row => row.status === 'pending').length || 0);
const locatedAiRowId = ref('');
const productTable = ref<{ $el: HTMLElement; setScrollTop: (top: number) => void }>();
function receiveAiRetryReport(value: AiRetryReport) {
	if (quote.value) quote.value.body.ai_retry_report = value;
}
async function applyAiRetryBatch(reportId: string, ids: string[], undo: boolean) {
	if (!quote.value || dirty.value || locked.value || busy.value || saving.value) throw { code: 1, msg: '报价已有修改或正在处理，请保存后重新核对建议。' };
	const target = quote.value;
	const replaceManualReview = !!(target.result?.manual_review_import || target.body.manual_review_snapshot?.requires_confirmation);
	if (replaceManualReview) {
		try { await confirm('本单包含人工校对价格。统一试算会按系统规则替换人工结果，原人工价格保留供核对。确认继续？'); }
		catch { throw { code: 1, msg: '已取消，本批修改未保存，勾选保留。' }; }
		if (quote.value !== target || dirty.value) throw { code: 1, msg: '报价已变化，请重新打开建议。' };
	}
	busy.value = true;
	try {
		const response = await quoteApi.applyAiRetry(target.id, target.revision, reportId, ids, undo, replaceManualReview);
		if (!(await applyMutation(target, response, true))) throw new Error('报价已切换，请打开原报价查看结果');
	} finally { busy.value = false; }
}
async function locateAiRetryRow(rowId: string) {
	const index = quote.value?.body.rows.findIndex(row => row.row_id === rowId) ?? -1;
	if (index < 0 || !quote.value) { ElMessage.warning('原清单行不存在，请刷新报价'); return; }
	productSearch.value = ''; productCategory.value = ''; importIssueKind.value = ''; onlyReviewRows.value = false;
	await nextTick();
	productPage.value = Math.floor(index / productPageSize.value) + 1; locatedAiRowId.value = rowId;
	await nextTick();
	const element = productTable.value?.$el.querySelector<HTMLElement>('.ai-located-row');
	if (element) productTable.value?.setScrollTop(element.offsetTop);
	openRow(quote.value.body.rows[index]);
}
async function locateExcelRow(rowId: string) {
	excelResultDialog.value = false;
	reviewDialog.value = false;
	await locateAiRetryRow(rowId);
}
const importIssueKind = ref('');
const hasSourceRows = computed(() => quote.value?.body.rows.some((row) => !!row.original || !!row.source_sheet || row.source_row != null));
watch(
	() => quote.value?.id,
	() => {
		selectedRowIds.value = [];
		productPage.value = 1;
		productSearch.value = '';
		productCategory.value = '';
		importIssueKind.value = '';
	}
);
function toggleRowSelection(row: QuoteRow, checked: boolean | string | number) {
	selectedRowIds.value = selectPageRows(selectedRowIds.value, [row], !!checked);
}
function togglePageSelection(checked: boolean | string | number) {
	selectedRowIds.value = selectPageRows(selectedRowIds.value, visibleProductRows.value, !!checked);
}
function scopeApplied(count: number) {
	ElMessage.success(`已设置 ${count} 行报价范围，请保存并重新核验或试算`);
}
function openInstallationSetup() {
	drawer.value = false;
	document.getElementById('quote-installation-conditions')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function openSource(index: number) {
	sourceIndex.value = index;
	sourceCompareDialog.value?.open();
}
function batchApplied(count: number) {
	ElMessage.success(`已补充 ${count} 行，请保存并重新核验或试算`);
}
/** 校对价格回导按已修改、仍待补全、未修改三组展示，便于确认人工修改及未完成报价的产品。 */
const changedReviewRows = computed(() => reviewPreview.value?.review_rows.filter((row) => row.changed) || []),
	pendingReviewRows = computed(() => reviewPreview.value?.review_rows.filter((row) => row.pending && !row.changed) || []),
	unchangedReviewRows = computed(() => reviewPreview.value?.review_rows.filter((row) => !row.changed && !row.pending) || []);
const allScopeRestorationsConfirmed = computed(() => scopeRestorationsConfirmed(reviewPreview.value?.scope_restorations || [], restoreScopeRowIds.value));
const options = computed(() => quote.value!.body.duct_options);
const isAuto = computed(() => quote.value?.body.recognition_mode === 'auto_v1');
/** AI 清单处于 pending 时必须人工核验才能试算；未知名称计数帮助报价员检查识别失败项目。 */
const aiReviewPending = computed(() => quote.value?.body.ai_review_status === 'pending');
/** AI 草稿的未保存修改也立即要求重新核验，无需先保存才能显示核验入口。 */
const aiReviewRequired = computed(() => !!quote.value?.body.ai_review_status && (aiReviewPending.value || dirty.value));
const aiUnknownNameCount = computed(() => quote.value?.body.rows.filter((row) => row.name === '待识别材料').length || 0);
/** 按未排除行决定整单风管/设备条件是否显示；清单识别摘要仍保留每类数量，未知产品单独展示。 */
const hasDuctRows = computed(() => quote.value?.body.rows.some((row) => !row.excluded && !row.installation_only && row.category === '风管'));
const hasEquipmentRows = computed(() => quote.value?.body.rows.some((row) => !row.excluded && !row.installation_only && row.category && row.category !== '风管'));
const recognitionSummary = computed(() => {
	const rows = quote.value?.body.rows || [];
	return `风管 ${rows.filter((row) => row.category === '风管').length} 项 / 设备 ${
		rows.filter((row) => row.category && row.category !== '风管').length
	} 项 / 待识别 ${rows.filter((row) => !row.category).length} 项`;
});
/** 设备或混合模式使用设备整单条件，风管报价保留风管条件；前端据此选择输入与显示精度。 */
const isEquipment = computed(() => ['equipment_v1', 'mixed_v1'].includes(quote.value?.body.pricing_mode || ''));
const orderOptions = computed(() => (isEquipment.value ? quote.value?.body.equipment_options : undefined) || options.value);
const selectedEquipment = computed(() =>
	selectedRuleBody.value
		? selectedRuleBody.value.rule_type === 'combination' || selectedRuleBody.value.category !== '风管'
		: isEquipment.value && (quote.value?.body.pricing_mode === 'equipment_v1' || selectedRow.value?.category !== '风管')
);
/** 优先展示本行私有规则，再查共用规则引用和上次匹配结果。未试算时只有名称/单位唯一且无适用条件的规则才直接展示，条件匹配交由引擎判断。 */
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
	// 未试算时只展示无歧义的规则；带条件的实际匹配仍由报价引擎判断。
	return candidates.length === 1 && !Object.keys(candidates[0].body.conditions || {}).length ? candidates[0].body : undefined;
});
const selectedCustomParameters = computed(() =>
	selectedRuleBody.value?.rule_type === 'formula' ? selectedRuleBody.value.custom_cost?.parameters || [] : []
);
/** 按本行规则生成参数表单：公式仅展示被引用的尺寸，面积/周长带出宽高；组合展示公共尺寸，普通产品使用已有类别字段。 */
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
				selectedRow.value?.attributes.equipment_kind || selectedRuleBody.value?.attributes.equipment_kind || '',
				[selectedRuleBody.value?.canonical_name, selectedRow.value?.name, selectedRow.value?.spec, selectedRow.value?.remark].filter(Boolean).join(' '),
				{ ...selectedRuleBody.value?.attributes, ...selectedRow.value?.attributes }
		  )
		: rowFields;
});
/** 正文改变即标记未保存；当前行和计算行按相同索引对应，参数修改后显示的选型仍属于上次结果。 */
const { dirty, rowIndices, resetBaseline } = createQuoteEditState(() => quote.value?.body);
const hasModifiedRows = computed(() => (quote.value?.body.rows || []).some((_row, index) => rowModified(index)));
const selectedRow = computed(() => quote.value?.body.rows[selected.value]),
	selectedResult = computed(() => quote.value?.result?.rows[selected.value]);
const selectedConfidenceReason = computed(() => currentAiConfidenceReason(selectedRow.value, quote.value?.body.ai_review_status));
const productCategories = computed(() => [...new Set((quote.value?.body.rows || []).map((row) => row.category || '待识别'))]);
const filteredProductRows = computed(() => {
	const rows = filterQuoteRows(quote.value?.body.rows || [], productSearch.value, productCategory.value)
		.filter(row => !importIssueKind.value || row.import_review?.issues.some(issue => issue.kind === importIssueKind.value));
	return onlyReviewRows.value ? rows.filter((row) => rowNeedsAttention(originalIndex(row))) : rows;
});
const visibleProductRows = computed(() => pageQuoteRows(filteredProductRows.value, productPage.value, productPageSize.value));
const missingRowIdCount = computed(() => (quote.value?.body.rows || []).filter((row) => !row.row_id).length);
const selectableVisibleRows = computed(() => visibleProductRows.value.filter((row) => !!row.row_id));
const allVisibleSelected = computed(() => !!selectableVisibleRows.value.length && selectableVisibleRows.value.every((row) => selectedRowIds.value.includes(row.row_id!)));
const someVisibleSelected = computed(() => visibleProductRows.value.some((row) => !!row.row_id && selectedRowIds.value.includes(row.row_id)));
const scopeCounts = computed(() => quoteScopeCounts(quote.value?.body.rows || [], dirty.value ? [] : quote.value?.result?.rows || [], rowNeedsAttention));
watch([productSearch, productCategory, importIssueKind, onlyReviewRows, productPageSize], () => { productPage.value = 1; });
watch(() => filteredProductRows.value.length, (length) => { productPage.value = Math.min(productPage.value, Math.max(1, Math.ceil(length / productPageSize.value))); });
const selectedFan = computed(() => selectedResult.value?.detail?.selected_fan);
const selectedFanDisplayName = computed(() =>
	[selectedFan.value?.family, selectedFan.value?.model].filter((value, index, values) => value && values.indexOf(value) === index).join(' · ')
);
/** 导出入口要求已有结果、正文未修改、结果未过期且未归档；正式导出还需后端检查待确认项目、指标版本及模板许可。 */
const exportable = computed(() => !!quote.value?.result && !dirty.value && !quote.value?.result_stale && quote.value?.state !== 'archived'
	&& (quote.value?.state !== 'draft' || (!regionNeedsSave.value && !projectRegionIssue(quote.value.body))));
/** 整单费用以后台结果为准；标明已含于行价的法兰、配件、税费和设备运费，避免阅读汇总时重复相加。 */
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
/** 风管行金额保留一位小数，设备行以整数元展示；这只是展示精度，取整由计算引擎完成。 */
function rowDigits(index: number) {
	return isEquipment.value && (quote.value?.body.pricing_mode === 'equipment_v1' || quote.value?.body.rows[index]?.category !== '风管') ? 0 : 1;
}
/** 每个指标系列先取已生效的最新发布/停用版本，再检查发布状态和截止日期；最新版本失效时不会回退旧价，只有唯一可用系列才作为界面参考。 */
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
/** 付款方案优先跟随供货组，全仅安装按安装产品分组；整单是否安装仍由原安装选项控制。 */
const orderPaymentTerms = computed(() =>
	scopePaymentTerms(quote.value?.body.rows || [], quote.value?.body.pricing_mode || '', activeCatalog.value?.body.payment_terms || [], activeEquipment.value?.body.payment_terms || [], !!quote.value?.body.installation_options?.included)
);
/** 混合报价同步设备整单含税、付款和安装状态到风管默认条件，保证同一订单使用统一结算口径。 */
function syncEquipment() {
	if (quote.value?.body.pricing_mode !== 'mixed_v1' || !quote.value.body.equipment_options) return;
	options.value.tax_included = quote.value.body.equipment_options.tax_included;
	options.value.payment_option = quote.value.body.equipment_options.payment_option;
	options.value.include_installation = !!quote.value.body.installation_options?.included;
}
/** 把唯一的整单运费选择同步到风管和设备选项；不清除设备每台/每个已填写运费，方便切回含运费。 */
function freightChanged() {
	if (!quote.value || quote.value.body.include_freight == null) return;
	options.value.include_freight = quote.value.body.include_freight;
	if (quote.value.body.equipment_options) quote.value.body.equipment_options.include_freight = quote.value.body.include_freight;
}
/** 同步整单是否安装并切换对应现金方案；原非现金付款方案需重新确认，同时提示安装指标缺失情况。 */
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
/** 按引擎返回的计价数量/单位显示“数量 × 单价”，缺少返回字段时回退到客户工程量或设备数量，保留待确认金额。 */
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
/** 展示需另计的角钢/圆法兰金额，并说明最终材料合计，便于核对主体单价与完整行金额的差异。 */
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
/** AI 尚未形成试算时暂不把原始核验理由用于报价状态高亮；普通清单或已有结果时允许显示核对提醒。 */
function canShowReviewReason() {
	return !quote.value?.body.ai_review_status || !!quote.value?.result;
}
/** 按最新规则试算状态读取有效核验提示，避免已计算行、操作按钮和明细继续使用旧提醒。 */
function rowReviewReason(index: number) {
	const result = rowReviewResult(index);
	return currentReviewReason(quote.value?.body.rows[index], result, canShowReviewReason() || !!result, quote.value?.body.ai_review_status);
}
/** 待处理依据单独按行 ID 保存，旧金额不参与显示、汇总或正式导出。 */
function rowReviewResult(index: number) {
	if (!dirty.value && !quote.value?.result_stale && quote.value?.result) return quote.value.result.rows[index];
	if (reviewSnapshot.value?.quoteId !== quote.value?.id) return undefined;
	return previousRowReview(reviewSnapshot.value, quote.value?.body.rows[index], !!quote.value?.body.installation_options?.included);
}
function rowModified(index: number) {
	const row = quote.value?.body.rows[index];
	if (!row || reviewSnapshot.value?.quoteId !== quote.value?.id) return false;
	let modified = rowModifications.get(row);
	if (!modified) {
		modified = computed(() => reviewRowModified(reviewSnapshot.value, row));
		rowModifications.set(row, modified);
	}
	return modified.value;
}
function previousPendingReason(index: number) {
	const result = rowReviewResult(index);
	return [result?.status === 'pending' ? result.reason : '', result?.installation_status === 'pending' ? result.installation_reason : '']
		.filter(Boolean).join('；');
}
/** 连续编辑时保留其他行的待处理依据；实际修改行直到成功试算后才退出待处理列表。 */
function rowAttention(index: number) {
	const result = rowReviewResult(index);
	const state = rowAttentionState(
		quote.value?.body.rows[index],
		result,
		canShowReviewReason() || !!result,
		quote.value?.body.ai_review_status,
		!!quote.value?.body.installation_options?.included
	);
	return state === 'none' && rowModified(index) ? 'review' : state;
}
function rowNeedsAttention(index: number) {
	return rowAttention(index) !== 'none';
}
/** 表格筛选只改变可见行，计算、原表定位和输入编辑均继续使用原清单位置。 */
function originalIndex(row: QuoteRow) {
	return rowIndices.value.get(row) ?? -1;
}
function productRowKey(row: QuoteRow) {
	return row.row_id || `legacy-${originalIndex(row)}`;
}
function visibleRowNumber(index: number) {
	return originalIndex(visibleProductRows.value[index]) + 1;
}
/** 导入核验提醒显示黄色，试算后的材料或安装待确认显示红色，未试算行不高亮。 */
function rowClass({ row }: { row: QuoteRow }) {
	if (row.row_id === locatedAiRowId.value) return 'ai-located-row';
	if (row.excluded) return 'excluded-row';
	const state = rowAttention(originalIndex(row));
	return state === 'pending' ? 'pending-row' : state === 'review' ? 'review-needed-row' : '';
}
/** 记录选中行的索引并打开参数/明细抽屉，使输入、来源和上次计算结果在同一行对应。 */
function openRow(row: QuoteRow) {
	selected.value = originalIndex(row);
	drawer.value = true;
}
/** 按当前行已有规则和生效共用系列打开配置；本行私有规则与共用引用分别传入，便于保持引用关系。 */
function openProductRule(row: QuoteRow) {
	selected.value = originalIndex(row);
	const body = selectedRuleBody.value;
	const family =
		body && !row.product_rule
			? row.product_rule_family ||
			  selectedResult.value?.product_rule?.family ||
			  productRules.value.find((rule) => rule.body === body && activeProductRule(rule.family)?.id === rule.id)?.family
			: undefined;
	productRuleDialog.value?.open(row, body, family);
}
/** 查询某规则系列已到生效日的最新发布/停用版本，只有仍处于发布且未过期时才可引用，失效不回退旧规则。 */
function activeProductRule(family: string) {
	const date = new Date().toLocaleDateString('sv-SE');
	const latest = productRules.value
		.filter((rule) => rule.family === family && ['published', 'retired'].includes(rule.status) && (rule.body.effective_from || '') <= date)
		.sort((a, b) => b.version - a.version)[0];
	return latest?.status === 'published' && (!latest.body.effective_to || latest.body.effective_to >= date) ? latest : undefined;
}
/** 依据对象或稳定 row_id 找到目标行，应用共用系列引用或本单规则，并保存整单。普通单继续试算，AI 单修改后需重新核验；失败时保留输入供重试。 */
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
		row.installation = definition.row.installation;
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
	/** AI 草稿的产品规则修改同样属于输入变化，需要先保存并重新人工核验，不能直接沿用旧审批。 */
	const requiresAiReview = !!quote.value.body.ai_review_status;
	const saved = await save(!requiresAiReview);
	if (!saved && quote.value?.id === quoteId && quote.value.body.rows[index]) Object.assign(definition.row, quote.value.body.rows[index]);
	if (saved) {
		try {
			await refreshProductRules();
		} catch (error) {
			report(error);
		}
	}
	return saved;
}
/** 取消本行私有规则及共用引用，恢复自动匹配；实际重新识别和计算仍需后续保存或试算。 */
function clearProductRule() {
	if (!selectedRow.value || locked.value) return;
	delete selectedRow.value.product_rule;
	delete selectedRow.value.product_rule_family;
	ElMessage.success('已恢复自动匹配，请重新识别或保存试算');
}
/** 将全新产品的计算轨迹变量转为中文参数名称，便于查看本次公式与实际参数的对应关系。 */
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
/** 追加空白产品和安装条件；自动/设备工作台不预设品类与单位，打开抽屉供报价员确认。 */
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
/** 成品状态调整后补齐缺失管型默认值，避免未设定类型导致表单无选项。 */
function stateChanged() {
	if (!options.value.shape) options.value.shape = 'semi_unspecified';
}
/** 以报价编号切换工作台，具体版本读取由路由监听触发。 */
async function navigate(id: string) {
	await router.push({ path: '/quotation/workbench/index', query: { id } });
}
/** 读取服务端当前版本，补齐历史安装字段，再建立正文基线并关闭旧行抽屉，保证后续保存使用最新 revision。 */
function projectProvinceChanged() {
	if (!quote.value) return;
	quote.value.body.project_region_confirmed = !!quote.value.body.project_region;
	deliveryProvinceChanged();
}
function acceptSuggestedProvince() {
	if (!quote.value || quote.value.body.project_region_suggestions?.length !== 1) return;
	quote.value.body.project_region = quote.value.body.project_region_suggestions[0];
	projectProvinceChanged();
}
function deliveryProvinceChanged() {
	if (!quote.value) return;
	if (hasManualRegionPrices(quote.value.body) || quote.value.result?.manual_review_import) quote.value.body.region_prices_confirmed = false;
	syncProjectRegion(quote.value.body);
	ElMessage.info({ message: '地区已更新，请保存并重新试算', grouping: true });
}
async function loadQuote(id: string) {
	const request = ++quoteLoadRequest;
	const value = await quoteApi.detail(id);
	if (request !== quoteLoadRequest) return;
	applyQuote(value);
}
/** 详情读取、保存和试算均应用同一份服务端权威正文，保持行 ID、核验状态和修改基线一致。 */
function applyQuote(value: Quote) {
	regionNeedsSave.value = value.body.project_region === undefined;
	prepareInstallation(value.body);
	prepareProjectRegion(value.body);
	value.body.rows.forEach((row) => { row.installation_only ??= false; });
	reviewSnapshot.value = updateReviewSnapshot(reviewSnapshot.value, value);
	quote.value = value;
	resetBaseline();
	drawer.value = false;
}
async function applyMutation(target: Quote, response: QuoteMutationResult | undefined, calculated: boolean) {
	if (quote.value !== target) return false;
	if (response?.body && response.state && typeof response.result_stale === 'boolean' && (!calculated || response.result)) {
		applyQuote({ ...target, ...response, body: response.body, state: response.state, result: response.result ?? null, result_stale: response.result_stale });
	} else {
		// 兼容尚未更新的后端；仅此时补读详情。保存成功即清除旧结果，详情失败也不能沿用旧价格。
		if (response) target.revision = response.revision;
		if (!calculated) target.result = null;
		const value = await quoteApi.detail(target.id);
		if (quote.value !== target) return false;
		applyQuote(value);
	}
	return true;
}
/** 保留上次可见规则；只有最新请求可更新草稿状态，读取失败不能伪装成空列表。 */
async function refreshProductRules() {
	const request = ++productRulesRequest;
	productRulesLoadState.value = 'loading';
	try {
		const rules = await quoteApi.productRules();
		if (request !== productRulesRequest) return;
		productRules.value = rules;
		productRulesLoadState.value = 'ready';
	} catch (error) {
		if (request !== productRulesRequest) return;
		productRulesLoadState.value = 'error';
		throw error;
	}
}
/** 规则操作成功后刷新两个入口；校验仍是草稿，点击管理按钮不会清除提醒。 */
async function productRulesChanged() {
	try {
		await refreshProductRules();
	} catch (error) {
		report(error);
	}
}
const catalogsLoaded = ref(false);
/** 列表由 QuoteList 读取摘要；打开具体报价后才加载完整指标、规则和清单。 */
async function initialize() {
	const request = ++initializeRequest;
	++quoteLoadRequest;
	const id = route.query.id ? String(route.query.id) : '';
	busy.value = true;
	failed.value = false;
	if (!id) {
		quote.value = undefined;
		reviewSnapshot.value = undefined;
		busy.value = false;
		return;
	}
	try {
		const [resources] = await Promise.all([quoteApi.resources(), refreshProductRules()]);
		if (request !== initializeRequest) return;
		catalogs.value = resources;
		catalogsLoaded.value = true;
		await loadQuote(id);
	} catch (error) {
		if (request !== initializeRequest) return;
		failed.value = true;
		report(error);
	} finally {
		if (request === initializeRequest) busy.value = false;
	}
}
/** 新建 auto_v1 空白草稿并进入工作台，保存后由引擎按行识别产品，不要求整单预选类型。 */
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
/** 保存可选地继续试算：应用权威正文与修订号；若保存撤销 AI 核验则中止试算，避免未核对清单直接报价。 */
async function save(calculate: boolean) {
	if (!quote.value || saving.value) return false;
	if (calculate && projectRegionIssue(quote.value.body)) {
		ElMessage.warning(projectRegionIssue(quote.value.body));
		return false;
	}
	if (calculate && aiReviewRequired.value) {
		ElMessage.warning('请先人工核验AI清单');
		return false;
	}
	if (calculate && quote.value.body.include_freight == null) {
		ElMessage.warning('请先选择整单是否含运费');
		return false;
	}
	const targetId = quote.value.id;
	const targetRevision = quote.value.revision;
	const replaceManualReview = calculate && !!(quote.value.result?.manual_review_import || quote.value.body.manual_review_snapshot?.requires_confirmation);
	if (replaceManualReview) {
		try { await confirm('本单包含人工校对价格。重新试算会按系统规则替换人工结果，原人工价格将保留供核对。确认重新试算？'); }
		catch { return false; }
		if (quote.value?.id !== targetId || quote.value.revision !== targetRevision || saving.value) return false;
	}
	saving.value = true;
	busy.value = true;
	try {
		const id = quote.value.id;
		/** 修改正文后重新保存会使旧试算失效；按服务端返回的核验状态决定是否继续计算。 */
		if (dirty.value || regionNeedsSave.value) {
			const target = quote.value;
			const saved = await quoteApi.save(id, target.body, target.revision);
			if (!(await applyMutation(target, saved, false))) return false;
		}
		if (calculate) {
			if (aiReviewPending.value) {
				ElMessage.warning('草稿修改后请重新人工核验，再试算');
				return false;
			}
			const target = quote.value;
			const result = await quoteApi.calculate(id, target.revision, replaceManualReview);
			if (!(await applyMutation(target, result, true))) return false;
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
/** 一次确认后按当前修订保存、记录人工核验并试算；未修改且已核验时直接试算，失败不会继续后续步骤。 */
async function approveAi() {
	if (!quote.value || locked.value || !quote.value.body.ai_review_status || busy.value || saving.value || reviewingAi.value) return;
	if (projectRegionIssue(quote.value.body)) { ElMessage.warning(projectRegionIssue(quote.value.body)); return; }
	if (quote.value.body.include_freight == null) {
		ElMessage.warning('请先选择整单是否含运费');
		return;
	}
	const id = quote.value.id,
		revision = quote.value.revision,
		reviewedBody = JSON.stringify(quote.value.body);
	// 等待人工确认时仅防重复点击；提交请求后再显示加载遮罩，避免遮住确认按钮。
	reviewingAi.value = true;
	try {
		if (aiReviewRequired.value || regionNeedsSave.value) {
			await confirm('请确认已对照客户原始资料核对全部AI清单行，包括遗漏、规格、数量和单位。确认后将保存本次修改、记录人工核验并自动试算。');
			if (!quote.value || quote.value.id !== id || quote.value.revision !== revision || JSON.stringify(quote.value.body) !== reviewedBody) {
				ElMessage.warning('核验期间内容已变化，请核对当前内容后重新确认');
				return;
			}
			if ((dirty.value || regionNeedsSave.value) && !(await save(false))) return;
			busy.value = true;
			if (!quote.value || quote.value.id !== id || locked.value) return;
			await quoteApi.approveAi(id, quote.value.revision);
			await loadQuote(id);
		}
		if (!quote.value || quote.value.id !== id) return;
		await save(true);
	} catch (error) {
		report(error);
	} finally {
		reviewingAi.value = false;
		busy.value = false;
	}
}
/** 下载绑定当前已保存版本的 AI 待核验清单；页面有未保存输入时先阻止，避免离线文件与草稿内容不同。 */
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

/** AI 字段核验回导仅针对可编辑 AI 草稿，并要求页面已保存，保证下载、校验和回导处于同一版本。 */
function chooseAiInputFile() {
	if (!quote.value || locked.value || !quote.value.body.ai_review_status) return;
	if (dirty.value) {
		ElMessage.warning('页面有未保存修改，请先保存草稿，再下载当前版本的清单校验后回导');
		return;
	}
	aiInputFile.value?.click();
}

/** 记录待回导文件及目标报价修订号，先上传 .xlsx 生成字段变化预览；此阶段不调用 AI 重识别，也不改变单据或价格。 */
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

/** 确认差异后核对报价ID、revision及未保存状态，统一更新、记录核验并试算，再打开可重复查看的结果。 */
async function applyAiInputFile() {
	if (!quote.value || !aiInputPreview.value?.change_count || !aiInputTarget.value || locked.value || aiInputBusy.value) return;
	if (dirty.value || quote.value.id !== aiInputTarget.value.id || quote.value.revision !== aiInputTarget.value.revision) {
		aiInputError.value = '当前草稿已有变化，请关闭窗口，保存并重新上传当前版本的已校验清单';
		return;
	}
	aiInputBusy.value = true;
	aiInputError.value = '';
	try {
		await quoteApi.applyAiInputImport(aiInputTarget.value.id, aiInputTarget.value.revision, aiInputPreview.value.import_id, true);
		aiInputDialog.value = false;
		await loadQuote(aiInputTarget.value.id);
		excelResultDialog.value = true;
		ElMessage.success('Excel修改已更新并统一试算，请查看各行结果');
	} catch (error) {
		const detail = error as { msg?: string; message?: string };
		aiInputError.value = detail?.msg || detail?.message || '更新草稿失败，请刷新草稿后重新上传';
		if (!aiInputDialog.value) report(error);
	} finally {
		aiInputBusy.value = false;
	}
}
/** 按资料索引下载当前 AI 报价的原始客户资料，供人工核验产品、规格、数量和遗漏。 */
async function downloadAiSource(index: number, filename: string) {
	if (!quote.value) return;
	try {
		await quoteApi.downloadAiSource(quote.value.id, index, filename);
	} catch (error) {
		report(error);
	}
}
/** 先保存页面输入，再让后端重新识别草稿已有行，读取更新后的类别并提示风管、设备和待识别数量。 */
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
/** 从已保存版本创建新的报价版本，保留历史结果和文件；未保存输入不带入修订版，切换前重设离开提示基线。 */
async function revise() {
	if (!quote.value) return;
	try {
		await confirm('创建新的报价版本？未保存的修改不会带入新版本。');
		const result = await quoteApi.action(quote.value.id, quote.value.revision, 'revise');
		if (result.id) {
			resetBaseline();
			await navigate(result.id);
		}
	} catch (error) {
		report(error);
	}
}
/** 生成后直接下载文件并更新轻量版本摘要，避免重新读取整份报价造成下载等待或失败。 */
async function exportQuote(kind: string) {
	if (!quote.value || exporting.value) return;
	const target = quote.value;
	exporting.value = kind;
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
		const file = await quoteApi.export(target.id, target.revision, kind);
		if (quote.value === target) {
			target.state = file.quote_state;
			target.revision = file.quote_revision;
			if (!target.exports.some((item) => item.id === file.id)) target.exports.unshift(file);
		}
		await quoteApi.download(file.id, file.filename);
	} catch (error) {
		report(error);
	} finally {
		exporting.value = '';
		busy.value = false;
	}
}

/** 已有可用试算结果且草稿可编辑时，允许选择人工价格校对版，避免回导到锁定或结果过期版本。 */
function chooseReviewFile() {
	if (!quote.value || !exportable.value || locked.value) return;
	reviewFile.value?.click();
}

/** 上传 Excel 价格校对版生成人工修改与系统派生金额的预览，先显示差异供核对，尚不应用。 */
async function previewReviewFile(event: Event) {
	const input = event.target as HTMLInputElement,
		file = input.files?.[0];
	input.value = '';
	if (!file || !quote.value) return;
	busy.value = true;
	try {
		reviewPreview.value = await quoteApi.previewReviewImport(quote.value.id, quote.value.revision, file);
		keepSystemLocation.value = false;
		restoreScopeRowIds.value = [];
		reviewDialog.value = true;
	} catch (error) {
		report(error);
	} finally {
		busy.value = false;
	}
}

/** 把确认的人工价格回导应用到当前修订版，读取重新汇总的材料、安装和整单结果，并提示是否仍有待确认项。 */
async function applyReviewFile() {
	if (!quote.value || !reviewPreview.value?.change_count || !allScopeRestorationsConfirmed.value) return;
	if (reviewPreview.value.location_changed && !keepSystemLocation.value) return;
	busy.value = true;
	try {
		await quoteApi.applyReviewImport(quote.value.id, quote.value.revision, reviewPreview.value.import_id, restoreScopeRowIds.value, keepSystemLocation.value);
		reviewDialog.value = false;
		await loadQuote(quote.value.id);
		if (reviewPreview.value?.input_recalculated) {
			excelResultDialog.value = true;
			ElMessage.success('Excel参数已更新并重新试算，请查看各行结果');
		} else ElMessage.success(quote.value.result?.formal_ready ? '人工报价已回导，可以生成正式报价' : '人工报价已回导，仍有项目需要确认');
	} catch (error) {
		report(error);
	} finally {
		busy.value = false;
	}
}

/** 根据已保存的导出记录下载历史文件，使用原文件编号而不重新计算历史报价。 */
async function download(item: ExportRecord) {
	try {
		await quoteApi.download(item.id, item.filename);
	} catch (error) {
		report(error);
	}
}
/** 报价正文与已保存基线不同时，确认是否放弃修改；取消保持当前编辑页面。 */
async function leave() {
	if (!dirty.value) return true;
	try {
		await confirm('有未保存的修改，确定离开并放弃这些修改？');
		return true;
	} catch {
		return false;
	}
}
/** 返回工作台列表，路由离开守卫仍会处理未保存修改。 */
async function back() {
	await router.push('/quotation/workbench/index');
}
/** 关闭浏览器或刷新时提示未保存报价输入，补充路由跳转之外的离开保护。 */
function beforeUnload(event: BeforeUnloadEvent) {
	if (dirty.value) {
		event.preventDefault();
		event.returnValue = '';
	}
}
/** 路由离开、切换报价编号及浏览器关闭统一保护未保存输入；编号变化后重新加载当前版本。 */
onBeforeRouteLeave(leave);
onBeforeRouteUpdate(async (to, from) => to.query.id === from.query.id || (await leave()));
watch(() => route.query.id, initialize);
onMounted(() => {
	initialize();
	window.addEventListener('beforeunload', beforeUnload);
});
onBeforeUnmount(() => {
	++initializeRequest;
	++quoteLoadRequest;
	window.removeEventListener('beforeunload', beforeUnload);
});
</script>

<style scoped>
:deep(.q-table .ai-located-row > td.el-table__cell) {
	background: var(--el-color-primary-light-9);
	border-top: 2px solid var(--el-color-primary);
	border-bottom: 2px solid var(--el-color-primary);
}
/* 工作台行参数抽屉、风机候选与原始来源/计算明细的局部布局，使人工核对时能同时查看需求和选型结果。 */
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
.material-status-cell .review-reminder {
	color: var(--el-color-warning);
}
:deep(.q-table .review-needed-row) {
	--el-table-tr-bg-color: var(--el-color-warning-light-9);
}
:deep(.q-table .review-needed-row:hover > td.el-table__cell) {
	background-color: var(--el-color-warning-light-8) !important;
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
