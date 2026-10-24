<template>
	<main class="quotation-page" v-loading="busy && !confirming">
		<!-- 指标管理入口：风管、设备和安装分别维护版本，风管页面还提供公式中文对照、正式模板确认开关及报价审计查询。 -->
		<header class="q-header">
			<div>
				<h1>报价指标管理</h1>
				<p class="q-subtitle">维护风管与设备的基价、计价规则和付款方案，发布后用于新试算。</p>
			</div>
			<el-button :disabled="busy" v-if="catalogMode === 'duct' && canManage && !catalogs.length" type="primary" @click="seed">初始化基价草稿</el-button>
		</header>
		<el-tabs v-model="catalogMode">
			<el-tab-pane label="风管指标" name="duct">
				<el-empty v-if="!catalogs.length && !busy" description="尚未初始化指标，请报价负责人导入内置基价草稿并核对发布。" />
				<section v-if="editing">
					<div class="catalog-version-bar">
						<div>
							<el-tag :type="editing.status === 'draft' ? 'warning' : 'info'" effect="plain">{{ labels[editing.status] }}</el-tag
							><strong>{{ editing.body.name }} · V{{ editing.version }}</strong
							><span class="q-muted">{{ dirty ? '有未保存修改' : editable ? '草稿可编辑' : '此版本只读' }}</span>
						</div>
						<div class="catalog-version-actions">
							<el-button :disabled="busy" @click="versionHistoryVisible = !versionHistoryVisible">版本记录</el-button
							><el-button :disabled="busy" @click="metadataVisible = !metadataVisible">版本信息</el-button>
							<div v-if="canManage" class="q-toolbar">
								<template v-if="editable">
									<el-button :disabled="busy" @click="save">保存草稿</el-button>
									<el-button :disabled="busy" v-if="!regionalPrices || !editing.body.purchased_flanges" @click="act('load-regional-prices')"
										>载入地区价格与外购法兰</el-button
									>
									<el-button :disabled="busy || (!editing.id || dirty)" @click="act('trial')">校验指标</el-button>
									<el-button type="primary" :disabled="busy || (!editing.id || dirty)" @click="act('publish')">发布指标</el-button>
									<el-button :disabled="busy" v-if="editing.id" text type="danger" @click="act('delete')">删除草稿</el-button>
								</template>
								<template v-else>
									<el-button :disabled="busy" type="primary" @click="act('revise')">创建新版本</el-button>
									<el-button :disabled="busy" v-if="editing.status === 'published'" @click="act('retire')">停用此版本</el-button>
									<el-button :disabled="busy" v-else @click="act('reactivate')">重新启用</el-button>
								</template>
							</div>
						</div>
					</div>

					<div class="q-toolbar" style="margin: 16px 0">
						<strong>材料价格地区</strong>
						<el-select :disabled="busy" v-model="priceRegion" aria-label="材料吨价地区" style="width: 150px">
							<el-option v-for="region in ductPriceRegions" :key="region" :label="region" :value="region" />
						</el-select>
						<span class="q-muted">材料吨价与外购法兰单价按项目省份取价；空白表示未配置。</span>
					</div>
					<p v-if="!regionalPrices" class="catalog-scope">此历史版本仅维护贵州吨价。创建新版本或在草稿中载入地区吨价后，可维护各地区价格。</p>
					<p v-if="editing.body.regional_price_source" class="q-muted">吨价依据：{{ editing.body.regional_price_source }}</p>
					<div v-show="metadataVisible" class="catalog-metadata">
						<el-form label-position="top" :disabled="!editable" class="q-grid" @submit.prevent>
							<el-form-item label="指标名称"><el-input v-model="editing.body.name" /></el-form-item>
							<el-form-item label="生效日期"
								><el-date-picker v-model="editing.body.effective_from" type="date" value-format="YYYY-MM-DD" :clearable="false"
							/></el-form-item>
							<el-form-item label="失效日期（可留空）"
								><el-date-picker v-model="editing.body.effective_to" type="date" value-format="YYYY-MM-DD" @change="editing.body.effective_to ||= ''"
							/></el-form-item>
							<el-form-item label="指标来源"><el-input v-model="editing.body.source" /></el-form-item>
						</el-form>
					</div>
				</section>
				<div v-show="versionHistoryVisible || !editing" class="catalog-versions">
					<h3>风管指标版本</h3>
					<el-table :data="catalogs" row-key="id" :row-class-name="versionRowClass" class="q-table" @row-click="select" style="margin-top: 18px">
						<el-table-column label="指标名称" min-width="210"
							><template #default="{ row }"
								><el-button :disabled="busy" link type="primary" @click.stop="select(row)">{{ row.body.name }}</el-button></template
							></el-table-column
						>
						<el-table-column prop="version" label="版本" width="70" />
						<el-table-column label="浏览状态" width="110">
							<template #default="{ row }"><el-tag v-if="row.id === editing?.id" size="small" effect="plain">正在查看</el-tag></template>
						</el-table-column>
						<el-table-column label="状态" width="100"
							><template #default="{ row }">{{ labels[row.status] }}</template></el-table-column
						>
						<el-table-column label="生效时间" min-width="240"
							><template #default="{ row }">{{ row.body.effective_from }} ～ {{ row.body.effective_to || '长期有效' }}</template></el-table-column
						>
						<el-table-column prop="body.source" label="来源" min-width="260" show-overflow-tooltip />
					</el-table>
				</div>
				<div v-if="editing" class="catalog-layout">
					<nav class="catalog-directory" aria-label="风管指标目录">
						<p class="catalog-directory-label">风管目录</p>
						<div v-for="group in visibleDuctDirectory" :key="group.label" class="catalog-product-group">
							<p class="catalog-directory-label">{{ group.label }}</p>
							<div class="catalog-product-list">
								<button :disabled="busy"
									v-for="item in group.items"
									:key="item.id"
									type="button"
									:aria-current="tab === item.id ? 'page' : undefined"
									@click="tab = item.id"
								>
									{{ item.label }}
								</button>
							</div>
						</div>
					</nav>
					<div class="catalog-product-content">
						<p class="q-muted catalog-breadcrumb">风管指标 / {{ currentDuctGroup?.label }}</p>
						<div class="q-section-head">
							<h2>{{ currentDuct?.label }}</h2>
							<el-tag type="info" effect="plain">{{ isDuctMaterial ? '材质指标' : '本版本共用' }}</el-tag>
						</div>
						<section v-if="isDuctMaterial" class="catalog-product-section" aria-label="板材基价">
							<h3>板材基价</h3>
							<p class="catalog-scope">维护{{ priceRegion }}当前材质和厚度的吨位单价（元/吨）；其他地区价格独立保存。</p>
							<el-table :data="materials" class="q-table" max-height="550">
								<el-table-column prop="name" label="板材名称" min-width="210" />
								<el-table-column prop="thickness" label="厚度（mm）" width="130" />
								<el-table-column label="吨价（元/吨）" min-width="140"
									><template #default="{ row }"
										><el-input
											:model-value="ductTonPrice(row, priceRegion, regionalPrices)"
											@update:model-value="setDuctTonPrice(row, priceRegion, regionalPrices, $event)"
											:aria-label="priceRegion + row.name + '吨价'"
											:disabled="!priceEditable"
											placeholder="未配置"
											inputmode="decimal" /></template
								></el-table-column>
								<el-table-column label="原表位置" min-width="150"
									><template #default="{ row }">{{ ductTonPriceSource(row, priceRegion, regionalPrices) }}</template></el-table-column
								>
							</el-table>
							<h3 style="margin-top: 24px">缺少板厚时的默认选厚</h3>
							<p class="catalog-scope">客户已明确的板厚优先。矩形看长边，圆形看直径；共板法兰、共板打孔用中压，排烟系统或角钢法兰用高压，排烟优先。超过4000mm待确认。</p>
							<el-table :data="thicknessDefaults" class="q-table" aria-label="风管默认板厚">
								<el-table-column prop="range" label="长边／直径（mm）" min-width="200" />
								<el-table-column prop="medium" label="中压厚度（mm）" min-width="150" />
								<el-table-column prop="high" label="高压厚度（mm）" min-width="150" />
							</el-table>
						</section>
						<section v-if="tab === 'flanges'" class="catalog-product-section" aria-label="角钢法兰价格">
							<h3>按吨价公式计算的角钢法兰</h3>
							<p class="catalog-scope">黑角铁、热镀锌法兰的角铁材料部分乘 0.92 后再加加工费；吨价按项目省份取价，未配置时待确认。外购不含税成品固定价不重复折减。</p>
							<el-table :data="flangeDefaults" class="q-table" aria-label="角钢法兰默认选型" style="margin-bottom: 18px">
								<el-table-column prop="basis" label="面积口径" min-width="120" />
								<el-table-column prop="region" label="地区" min-width="130" />
								<el-table-column prop="size30" label="30号默认档位" min-width="190" />
								<el-table-column prop="size40" label="40号默认档位" min-width="190" />
							</el-table>
							<p v-if="editing.body.black_flange_regions && !editing.body.black_flange_regions.includes(priceRegion)" class="q-muted">
								{{ priceRegion }}不提供黑角铁法兰，仅展示可用法兰指标。
							</p>
							<el-table :data="flanges" class="q-table" max-height="550">
								<el-table-column prop="name" label="规格 / 档位" min-width="300" />
								<el-table-column prop="size" label="型号" width="80" /><el-table-column prop="grade" label="计算档位" width="110" />
								<el-table-column label="吨价（元/吨）" min-width="130"
									><template #default="{ row }"
										><el-input
											:model-value="ductTonPrice(row, priceRegion, regionalPrices)"
											@update:model-value="setDuctTonPrice(row, priceRegion, regionalPrices, $event)"
											:aria-label="priceRegion + row.name + '吨价'"
											:disabled="!priceEditable"
											placeholder="未配置"
											inputmode="decimal" /></template
								></el-table-column>
								<el-table-column label="加工费（元/米）" min-width="145"
									><template #default="{ row }"
										><el-input v-model="row.processing_per_m" :aria-label="row.name + '加工费'" :disabled="!editable" inputmode="decimal" /></template
								></el-table-column>
								<el-table-column label="吨价原表位置" min-width="180"
									><template #default="{ row }">{{ ductTonPriceSource(row, priceRegion, regionalPrices) }}</template></el-table-column
								>
							</el-table>
							<template v-if="editing.body.purchased_flanges">
								<h3 style="margin-top: 24px">外购不锈钢成品法兰 · 未税固定单价</h3>
								<p class="catalog-scope">
									成品每米总价已包含加工费，不使用吨价公式、不重复加加工费。按风管面积报价时，每米价 × {{ editing.body.rates.flange_area_factor }}
									折算为每平方米法兰费用；填写实际米数时按米另计，不重复按面积计费。
								</p>
								<el-table :data="editing.body.purchased_flanges" class="q-table" aria-label="外购法兰固定单价">
									<el-table-column prop="name" label="外购成品法兰" min-width="240" />
									<el-table-column label="规格" width="110"
										><template #default="{ row }">{{ row.size }}×{{ row.size }}</template></el-table-column
									>
									<el-table-column label="未税成品单价（元/米，含加工费）" min-width="230">
										<template #default="{ row }"
											><el-input
												:model-value="ductFixedPrice(row, priceRegion)"
												@update:model-value="setDuctFixedPrice(row, priceRegion, $event)"
												:aria-label="priceRegion + row.name + '成品每米价'"
												:disabled="!priceEditable"
												placeholder="未配置"
												inputmode="decimal"
										/></template>
									</el-table-column>
									<el-table-column label="每平方米折算（元/㎡）" min-width="190"
										><template #default="{ row }">{{
											ductFixedPrice(row, priceRegion) ? ductFixedPrice(row, priceRegion) + ' × ' + editing.body.rates.flange_area_factor : '未配置'
										}}</template></el-table-column
									>
									<el-table-column label="原表成品总价位置" min-width="190"
										><template #default="{ row }">{{ row.source_cells[priceRegion] || '未配置来源' }}</template></el-table-column
									>
								</el-table>
							</template>
						</section>
						<section v-if="visibleRateKeys.length" class="catalog-product-section" aria-label="风管加工与系数">
							<h3>{{ isDuctMaterial ? '共用加工参数' : '加工费与系数' }}</h3>
							<p class="catalog-scope">{{ rateScope }}</p>
							<el-form label-position="top" :disabled="!editable" class="q-grid" @submit.prevent>
								<el-form-item v-for="key in visibleRateKeys" :key="key" :label="rateLabels[key] || key"
									><el-input :model-value="editing.body.rates[key] ?? (key === 'circular_finished_extra' ? '30' : '')"
										@update:model-value="editing.body.rates[key] = $event" :aria-label="rateLabels[key] || key" inputmode="decimal"
								/></el-form-item>
							</el-form>
							<p v-if="tab === 'rates'" class="q-muted">
								明确圆形风管时，成品、半成品均按对应状态的角钢法兰方形直管单价，在面积换算后加圆形风管附加价（默认30元/㎡），再计运费及税费；已含法兰，不再另算法兰费用。选厚仍按客户连接形式区分中压和高压。旧圆管合口及圆法兰参数仅供历史依据查看。
							</p>
						</section>
						<section v-if="tab === 'payment'" class="catalog-product-section">
							<el-table :data="editing.body.payment_terms" class="q-table">
								<el-table-column label="范围" width="140"
									><template #default="{ row }">{{ row.mode === 'with_install' ? '含安装' : '不含安装' }}</template></el-table-column
								>
								<el-table-column prop="label" label="付款条件" min-width="330" />
								<el-table-column label="供货材料系数" width="190"
									><template #default="{ row }"><el-input v-model="row.coefficient" :disabled="!editable" inputmode="decimal" /></template
								></el-table-column>
							</el-table>
							<p class="q-muted" style="margin-top: 12px">必须保留全部 8 种已确认付款方案；每张报价单仍需由报价员明确选择。</p>
						</section>
						<section v-if="tab === 'expressions'" class="catalog-product-section">
							<el-alert
								title="仅修改已经核对的业务公式。发布前会检查变量、函数和数值；试算中的单价、行金额仍按 1 位小数四舍五入。"
								type="warning"
								:closable="false"
								style="margin-bottom: 18px"
							/>
							<el-form label-position="top" :disabled="!editable" @submit.prevent>
								<section v-for="formula in formulaGuides" :key="formula.key" class="q-formula">
									<el-form-item :label="formula.label">
										<el-input v-model="editing.body.expressions[formula.key]" :aria-label="formula.label" />
									</el-form-item>
									<p class="q-formula-preview"><span>中文对照</span>{{ formula.chinese }}</p>
									<p class="q-formula-note">{{ formula.note }}</p>
									<div class="q-formula-scroll">
										<table class="q-formula-parameters">
											<caption>
												本公式的参数说明
											</caption>
											<thead>
												<tr>
													<th scope="col">英文参数</th>
													<th scope="col">中文含义</th>
													<th scope="col">单位</th>
													<th scope="col">取值来源与使用说明</th>
												</tr>
											</thead>
											<tbody>
												<tr v-for="parameter in formula.parameters" :key="parameter.key">
													<th scope="row">
														<code>{{ parameter.key }}</code>
													</th>
													<td>{{ parameter.label }}</td>
													<td>{{ parameter.unit }}</td>
													<td>{{ parameter.description }}</td>
												</tr>
											</tbody>
										</table>
									</div>
								</section>
							</el-form>
							<p class="q-muted">
								编辑公式时使用英文参数名，中文对照会随输入同步更新。支持 +、-、*、/ 和括号；min 取最小值、max 取最大值、abs 取绝对值、ceil
								向上取整、floor 向下取整、round 四舍五入（如 round(material_price, 1) 表示板材成本保留 1 位小数）。
							</p>
						</section>
					</div>
				</div>
				<p v-if="editing" class="catalog-footer">各类风管共用当前指标版本。修改后请保存、校验并发布；停用最新版本后不会自动回退到旧价格。</p>
			</el-tab-pane>
			<el-tab-pane label="设备指标" name="equipment" lazy
				><EquipmentCatalogPanel :initial-product="String(route.query.product || '')" :initial-section="String(route.query.section || '')"
			/></el-tab-pane>
			<el-tab-pane label="安装指标" name="installation" lazy><InstallationCatalogPanel /></el-tab-pane>
		</el-tabs>
		<section v-if="settings" class="q-section">
			<div class="q-section-head">
				<h2>正式报价模板</h2>
				<el-switch
					:model-value="settings.policy.formal_template_confirmed"
					:disabled="busy || !canManage"
					active-text="已确认模板"
					inactive-text="暂停正式导出"
					@change="changeTemplate"
				/>
			</div>
			<p class="q-muted">
				不含安装使用「单层材料」，含安装使用「带安装」。模板版本 {{ settings.template_version }}，引擎 {{ settings.engine_version }}。
			</p>
		</section>
		<AuditHistory v-if="canManage" />
	</main>
</template>
<script setup lang="ts" name="QuotationCatalog">
/** 指标管理入口：风管、设备和安装分别维护版本，风管页面还提供公式中文对照、正式模板确认开关及报价审计查询。 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { onBeforeRouteLeave, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { auth } from '/@/utils/authFunction';
import { quoteApi } from '/@/api/quotation';
import { report, confirm } from '/@/views/quotation/shared';
import type { Catalog, QuoteSettings } from '/@/types/quotation';
import '/@/views/quotation/quotation.scss';
import './catalogLayout.scss';
import { ductDirectory, ductMaterialGroup, ductRateGroup } from './indicatorDirectory';
import {
	ductPriceRegions,
	ductTonPrice,
	setDuctTonPrice,
	ductTonPriceSource,
	visibleDuctFlanges,
	ductFixedPrice,
	setDuctFixedPrice,
} from './ductRegionalPrices';
import EquipmentCatalogPanel from './EquipmentCatalogPanel.vue';
import InstallationCatalogPanel from './InstallationCatalogPanel.vue';
import AuditHistory from './AuditHistory.vue';
/** 当前指标类型与风管表格标签页独立保存，设备和安装委托专用面板处理。 */
const route = useRoute();
const catalogMode = ref(['equipment', 'installation'].includes(String(route.query.mode)) ? String(route.query.mode) : 'duct');
/** 风管版本、编辑副本、设置与正文基线用于指标维护；保存或动作完成后重新读取，确保使用最新修订号。 */
const catalogs = ref<Catalog[]>([]),
	editing = ref<Catalog>(),
	settings = ref<QuoteSettings>(),
	baseline = ref(''),
	busy = ref(false),
	confirming = ref(false),
	tab = ref('galvanized_40');
const versionHistoryVisible = ref(false),
	metadataVisible = ref(false);
const priceRegion = ref('贵州');
const regionalPrices = computed(() => !!editing.value?.body.price_regions);
const priceEditable = computed(() => editable.value && (regionalPrices.value || priceRegion.value === '贵州'));
const thicknessDefaults = [
	{ range: '≤320', medium: '0.5', high: '0.75' },
	{ range: '＞320且≤450', medium: '0.6', high: '0.75' },
	{ range: '＞450且≤630', medium: '0.75', high: '1.0' },
	{ range: '＞630且≤1000', medium: '0.75', high: '1.0' },
	{ range: '＞1000且≤1550', medium: '1.0', high: '1.2' },
	{ range: '＞1550且≤2000', medium: '1.2', high: '1.5' },
	{ range: '＞2000且≤4000', medium: '1.2', high: '1.5' },
];
const flangeDefaults = [
	{ basis: '净面积', region: '所有地区', size30: '30热镀锌8.5KG', size40: '40热镀锌14.5KG' },
	{ basis: '开板面积', region: '贵州', size30: '30黑角铁6.5KG', size40: '40黑角铁11.5KG' },
	{ basis: '开板面积', region: '其他地区', size30: '30热镀锌7.5KG', size40: '40热镀锌12.5KG' },
];
const visibleDuctDirectory = computed(() =>
	ductDirectory.map((group) => ({
		...group,
		items: group.items.filter(
			(item) => item.id !== 'other_material' || editing.value?.body.materials.some((row) => ductMaterialGroup(row.material) === 'other_material')
		),
	}))
);
const currentDuctGroup = computed(() => visibleDuctDirectory.value.find((group) => group.items.some((item) => item.id === tab.value)));
const currentDuct = computed(() => currentDuctGroup.value?.items.find((item) => item.id === tab.value));
const isDuctMaterial = computed(() => ductDirectory[0].items.some((item) => item.id === tab.value));
const materials = computed(() => (editing.value?.body.materials || []).filter((row) => ductMaterialGroup(row.material) === tab.value));
const flanges = computed(() => (editing.value ? visibleDuctFlanges(editing.value.body, priceRegion.value) : []));
const rateGroup = computed(() => (tab.value.startsWith('galvanized_') ? 'galvanized' : tab.value.startsWith('stainless_') ? 'stainless' : tab.value));
const visibleRateKeys = computed(() => [...new Set([...Object.keys(editing.value?.body.rates || {}), 'circular_finished_extra'])]
	.filter((key) => ductRateGroup(key) === rateGroup.value));
const rateScope = computed(() =>
	rateGroup.value === 'galvanized'
		? '40g 与 80g 镀锌风管共用以下加工参数，修改任一处会同步影响两类风管。'
		: rateGroup.value === 'stainless'
		? '201 与 304 不锈钢风管共用以下加工参数，板材吨价分别维护。'
		: '本版本中符合条件的风管共用以下参数。'
);
/** 负责人的管理权限与草稿状态共同决定编辑能力，dirty 仅比较当前指标正文以提示未保存修改。 */
const canManage = computed(() => auth('quote_manage')),
	editable = computed(() => canManage.value && !busy.value && editing.value?.status === 'draft');
const dirty = computed(() => !!editing.value && JSON.stringify(editing.value.body) !== baseline.value);
const labels: Record<string, string> = { draft: '草稿', published: '已发布', retired: '已停用' };
/** 把风管加工费、密度、法兰、配件、税费与净面积系数字段映射为中文说明，保留后台指标键名。 */
const rateLabels: Record<string, string> = {
	density_galvanized: '镀锌板密度',
	density_stainless: '不锈钢密度',
	galvanized_semi: '镀锌不区分管型加工费（元/㎡）',
	galvanized_straight: '镀锌直管加工费（元/㎡）',
	galvanized_irregular: '镀锌异形加工费（元/㎡）',
	galvanized_1_5_straight: '镀锌 1.5mm 直管加工费',
	galvanized_1_5_irregular: '镀锌 1.5mm 异形加工费',
	galvanized_1_5_unspecified: '镀锌 1.5mm 不区分管型加工费',
	galvanized_narrow_extra: '镀锌 A+B≤520mm 加价（元/㎡）',
	stainless_semi: '不锈钢不区分管型加工费',
	stainless_straight: '不锈钢直管加工费',
	stainless_irregular: '不锈钢异形加工费',
	closing_common: '共板合口费（元/㎡）',
	closing_angle: '角钢合口费（元/㎡）',
	closing_round: '旧圆管合口费（历史参数）',
	circular_finished_extra: '圆形风管附加价（元/㎡，成品／半成品均含法兰）',
	closing_0_5_extra: '0.5mm 成品额外合口费',
	accessory_per_sqm: '共板配件折算（元/㎡）',
	corner_unit_price: '角码实际单价（元/个）',
	clip_per_meter_price: '卡扣实际单价（元/米）',
	common_punch: '共板打孔费（元/㎡）',
	freight_per_sqm: '运费（元/㎡）',
	net_galvanized_common: '净面积系数 · 镀锌共板',
	net_galvanized_angle: '净面积系数 · 镀锌角钢',
	net_stainless: '净面积系数 · 不锈钢',
	net_round: '净面积系数 · 圆法兰',
	material_tax_factor: '材料含税系数',
	installation_tax_factor: '安装含税系数',
	flange_area_factor: '法兰米数折算面积系数',
};
const expressionLabels: Record<string, string> = {
	material_price: '板材成本 · 厚度 × 密度 × 吨价换算',
	body_sale: '风管主体 · 材料、加工、合口及配件',
	flange_per_meter: '角钢法兰 · 每米价格',
	flange_per_area: '角钢法兰 · 面积折算价格',
};
/** 公式帮助信息包含中文名称、单位和取值来源；只服务于核对说明，不参与表达式计算。 */
interface FormulaParameter {
	label: string;
	unit: string;
	description: string;
}
/** 已知风管公式变量的业务含义；尤其明确公式阶段 area_factor 固定为 1，实际净面积系数在后续汇总应用。 */
const formulaParameters: Record<string, FormulaParameter> = {
	thickness: { label: '板材厚度', unit: 'mm', description: '取报价行已核对的板材厚度，并据此匹配「板材基价」中的对应规格。' },
	density: { label: '板材密度', unit: '吨/m³', description: '按材质取「加工费与系数」中的镀锌板或不锈钢密度；数值与 g/cm³ 相同，例如 7.85。' },
	material_price: { label: '板材成本', unit: '元/㎡', description: '由「板材成本」公式计算得到，再用于风管主体价格计算。' },
	processing: {
		label: '风管加工费',
		unit: '元/㎡',
		description: '从「加工费与系数」按材质、厚度和直管/异形件类型取费，已包含符合 A+B≤520mm 条件时的附加加工费。',
	},
	closing: { label: '合管费', unit: '元/㎡', description: '半成品取 0；成品按法兰形式取对应合口费，0.5mm 成品还会加上额外合口费。' },
	accessory_per_sqm: {
		label: '角码卡扣费',
		unit: '元/㎡',
		description: '仅共板法兰适用。按面积计价时取「加工费与系数」中的共板配件折算费；进入实际角码/卡扣单独计价模式时，这里取 0。',
	},
	area_factor: {
		label: '公式阶段面积系数',
		unit: '无量纲',
		description: '本步骤固定传入 1。实际开板/净面积系数在主体、法兰等费用汇总后统一应用，请勿在此重复乘入净面积系数。',
	},
	flange_per_meter: { label: '角钢法兰每米价格', unit: '元/米', description: '由「角钢法兰 · 每米价格」公式计算得到，包含角钢材料价和每米加工费。' },
	flange_area_factor: {
		label: '法兰米数面积折算系数',
		unit: '米/㎡',
		description: '取「加工费与系数」中的法兰米数折算面积系数。未提供实际米数时，用于把元/米折算成元/㎡；实际米数计价不使用这项面积折算。',
	},
	flange_grade: {
		label: '角钢计算档位',
		unit: '业务档位值',
		description: '明确档位优先；默认按面积口径和项目省份选择。净面积取热镀锌30# 8.5、40# 14.5；开板贵州取黑角铁6.5/11.5，其他地区取热镀锌7.5/12.5；50# 需明确选择。',
	},
	flange_processing: { label: '角钢法兰加工费', unit: '元/米', description: '取「角钢法兰」中所选材质、规格和档位对应的每米加工费。' },
};
const formulaNotes: Record<string, string> = {
	material_price: '计算结果：板材成本（元/㎡）。0.001 用于将厚度从毫米换算为米，配合吨/m³的密度和元/吨的吨价计算。',
	body_sale: '计算结果：风管主体基础价（元/㎡）。法兰、打孔、运费及面积、付款、税费系数按各自规则继续计算。',
	flange_per_meter: '计算结果：角钢法兰基础价（元/米）。公式中的角钢吨价已乘0.92，不能重复折减；加工费不乘0.92。1000用于吨价换算，6为每根6米。',
	flange_per_area: '计算结果：角钢法兰面积折算价（元/㎡）。仅用于按面积折算法兰费用的情况。',
};
const formulaFunctions: Record<string, string> = {
	min: '最小值',
	max: '最大值',
	abs: '绝对值',
	ceil: '向上取整',
	floor: '向下取整',
	round: '四舍五入',
};
// 优先识别数值，避免把 1e-3 这类科学计数法误拆为变量。
/** 优先匹配数值与科学计数法，再匹配变量，避免把 1e-3 中的 e 误当公式参数。 */
const formulaTokenPattern = /(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[a-zA-Z_][a-zA-Z0-9_]*/g;
/** 按公式阶段解释吨价来源；已知变量使用业务定义，直接引用的费率显示当前指标值，无法识别的参数明确提示校验。 */
function describeParameter(key: string, expressionKey: string): FormulaParameter {
	if (key === 'ton_price') {
		const flange = expressionKey.startsWith('flange_');
		return {
			label: flange ? '角钢折税吨价' : '板材吨价',
			unit: '元/吨',
			description: flange ? '取项目省份、角钢材质、规格和档位对应的原始吨价乘0.92后传入；源吨价保持原值，加工费不折减。' : '取「板材基价」中与报价行材质、厚度匹配的吨价。',
		};
	}
	if (formulaParameters[key]) return formulaParameters[key];
	if (Object.prototype.hasOwnProperty.call(editing.value?.body.rates || {}, key)) {
		const label = rateLabels[key] || key;
		return { label, unit: '见对应参数', description: `取「加工费与系数」中的「${label}」，当前指标值为 ${editing.value?.body.rates[key]}。` };
	}
	return { label: `未识别参数：${key}`, unit: '待核对', description: '请核对参数名称；保存并校验指标时会检查公式是否合法。' };
}
/** 随草稿公式实时生成中文对照、结果单位和去重后的变量说明，便于负责人核对英文公式。 */
const formulaGuides = computed(() =>
	Object.entries(editing.value?.body.expressions || {}).map(([key, expression]) => {
		const variables = [
			...new Set((expression.match(formulaTokenPattern) || []).filter((token) => /^[a-zA-Z_]/.test(token) && !formulaFunctions[token])),
		];
		return {
			key,
			label: expressionLabels[key] || key,
			chinese: expression
				.replace(formulaTokenPattern, (token) => (/^[a-zA-Z_]/.test(token) ? formulaFunctions[token] || describeParameter(token, key).label : token))
				.replace(/\*/g, '×')
				.replace(/\//g, '÷'),
			note: formulaNotes[key] || '请核对公式对应的计算阶段与结果单位。',
			parameters: variables.map((variable) => ({ key: variable, ...describeParameter(variable, key) })),
		};
	})
);
/** 读取风管指标及模板设置，深拷贝选中版本并建立保存基线，避免修改已发布数据。 */
let reloadSequence = 0;
let disposed = false;
async function reload(id?: string, target = editing.value, input = JSON.stringify(target?.body)) {
	const request = ++reloadSequence;
	const loaded = (await quoteApi.resources()).filter((c) => c.kind === 'duct_catalog');
	const loadedSettings = await quoteApi.settings();
	if (disposed || request !== reloadSequence || editing.value !== target) return false;
	catalogs.value = loaded;
	settings.value = loadedSettings;
	const item = loaded.find((c) => c.id === id) || loaded[0];
	if (target && JSON.stringify(target.body) !== input) {
		if (item && (!target.id || item.id === target.id)) {
			target.id = item.id;
			target.revision = item.revision;
			baseline.value = JSON.stringify(item.body);
		}
		ElMessage.warning('请求后指标又有修改，已保留最新输入，请重新保存');
		return false;
	}
	editing.value = item ? JSON.parse(JSON.stringify(item)) : undefined;
	baseline.value = editing.value ? JSON.stringify(editing.value.body) : '';
	return true;
}

/** 离开页面或切换版本前确认是否放弃未保存的风管指标修改。 */
async function leave() {
	if (busy.value) {
		ElMessage.warning('请求处理中，请完成后再离开或切换版本');
		return false;
	}
	if (!dirty.value) return true;
	try {
		await confirm('有未保存的指标修改，确定放弃？');
		return true;
	} catch {
		return false;
	}
}
/** 高亮实际查看的版本，与设备、安装列表使用相同标记。 */
function versionRowClass({ row }: { row: Catalog }) {
	return row.id === editing.value?.id ? 'catalog-version-selected' : '';
}
/** 选中其他指标前处理未保存输入，再复制目标正文；重复选中当前版本不重复重置表单。 */
async function select(item: Catalog) {
	if (busy.value || editing.value?.id === item.id) return;
	const target = editing.value;
	if (!(await leave()) || busy.value || editing.value !== target) return;
	editing.value = JSON.parse(JSON.stringify(item));
	baseline.value = JSON.stringify(item.body);
}
/** 调用后端初始化基价草稿并进入新版本，负责人仍需核对、保存、校验和发布。 */
async function seed() {
	if (busy.value) return;
	busy.value = true;
	try {
		const r = await quoteApi.seed();
		await reload(r.id);
		ElMessage.success('基价草稿已建立，请核对后发布');
	} catch (e) {
		report(e);
	} finally {
		busy.value = false;
	}
}
/** 以当前资源 ID 和修订号保存风管草稿，成功后刷新正文与基线。 */
async function save() {
	if (!editing.value || !editable.value || busy.value) return;
	const target = editing.value;
	const submitted = JSON.parse(JSON.stringify(target));
	const input = JSON.stringify(submitted.body);
	busy.value = true;
	try {
		let id = submitted.id;
		if (id) await quoteApi.saveResource(submitted);

		if (disposed || editing.value !== target) return;
		if (await reload(id, target, input)) ElMessage.success('指标草稿已保存');
	} catch (e) {
		if (!disposed && editing.value === target) report(e);
	} finally {
		if (!disposed) busy.value = false;
	}
}

/** 执行发布、停用、删除、重新启用及修订等指标动作；停用最新版本不能自动退回旧价格，实际状态判断由后端负责。 */
async function act(action: string) {
	if (!editing.value || busy.value) return;
	const target = editing.value;
	const input = JSON.stringify(target.body);
	busy.value = true;
	try {
		const messages: Record<string, string> = {
			'load-regional-prices':
				'确认载入地区吨价与外购法兰成品价？保留已维护价格、公式和加工费，补充四种外购法兰及黑角铁仅贵州可用的范围。陕西及原表缺价留空。保存发布后用于新试算。',
			publish: '确认发布此指标？生效后，新试算将使用此版本。',
			retire: '确认停用？停用最新版本后将阻止新的正式报价，不会回退到旧版本。',
			delete: '确认删除这份指标草稿？',
			reactivate: '确认重新启用此版本？',
		};
		if (messages[action]) {
			// 确认期间保留操作锁，但不显示请求遮罩，以便用户确认或取消。
			confirming.value = true;
			try {
				await confirm(messages[action]);
			} finally {
				confirming.value = false;
			}
		}
		if (disposed || editing.value !== target || JSON.stringify(target.body) !== input) return;
		const result = await quoteApi.resourceAction(JSON.parse(JSON.stringify(target)), action);
		if (disposed || editing.value !== target) return;
		await reload(result.id || target.id, target, input);
		ElMessage.success(result.message || '操作完成');
	} catch (e) {
		report(e);
	} finally {
		if (!disposed) busy.value = false;
	}
}
/** 负责人确认正式模板后允许或暂停新的正式导出；提交设置修订号以防并发覆盖，历史导出文件仍保留。 */
async function changeTemplate(value: string | number | boolean) {
	if (!settings.value || busy.value) return;
	const target = settings.value;
	busy.value = true;
	try {
		confirming.value = true;
		try {
			await confirm(value ? '确认已核对正式报价模板并允许导出？' : '确认暂停正式报价导出？草稿仍可使用。');
		} finally {
			confirming.value = false;
		}
		if (disposed || settings.value !== target) return;
		const saved = await quoteApi.saveSettings(JSON.parse(JSON.stringify(target)), value === true);
		if (disposed || settings.value !== target) return;
		settings.value = saved;
		ElMessage.success('模板确认状态已更新');
	} catch (e) {
		if (!disposed) report(e);
	} finally {
		if (!disposed) busy.value = false;
	}
}
/** 关闭或刷新页面时，提醒当前风管指标存在未保存修改。 */
function beforeUnload(e: BeforeUnloadEvent) {
	if (dirty.value) {
		e.preventDefault();
		e.returnValue = '';
	}
}
onBeforeRouteLeave(leave);
onMounted(async () => {
	window.addEventListener('beforeunload', beforeUnload);
	busy.value = true;
	try {
		await reload();
	} catch (e) {
		report(e);
	} finally {
		busy.value = false;
	}
});
onBeforeUnmount(() => {
	disposed = true;
	reloadSequence++;
	window.removeEventListener('beforeunload', beforeUnload);
});
</script>
