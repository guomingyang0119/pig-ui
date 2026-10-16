<template>
	<div v-loading="busy" class="equipment-catalog">
		<div v-if="!editing" class="q-section-head">
			<h2>设备供货指标</h2>
			<el-button v-if="canManage" type="primary" @click="seed">从已核对源表建立草稿</el-button>
		</div>
		<section v-if="editing">
			<div class="catalog-version-bar">
				<div>
					<el-tag :type="editing.status === 'draft' ? 'warning' : 'info'" effect="plain">{{ stateLabels[editing.status] }}</el-tag
					><strong>{{ editing.body.name }} · V{{ editing.version }}</strong
					><span class="q-muted">{{ dirty ? '有未保存修改' : editable ? '草稿可编辑' : '此版本只读' }}</span>
				</div>
				<div class="catalog-version-actions">
					<el-button @click="versionHistoryVisible = !versionHistoryVisible">版本记录</el-button
					><el-button @click="metadataVisible = !metadataVisible">版本信息</el-button>
					<div v-if="canManage" class="q-toolbar">
						<template v-if="editable">
							<el-button @click="save">保存草稿</el-button>
							<el-button :disabled="!editing.id || dirty" @click="act('trial')">校验指标</el-button>
							<el-button type="primary" :disabled="!editing.id || dirty" @click="act('publish')">发布指标</el-button>
							<el-button v-if="editing.id" text type="danger" @click="act('delete')">删除草稿</el-button>
						</template>
						<template v-else>
							<el-button type="primary" @click="act('revise')">创建新版本</el-button>
							<el-button v-if="editing.status === 'published'" @click="act('retire')">停用此版本</el-button>
							<el-button v-else @click="act('reactivate')">重新启用</el-button>
						</template>
					</div>
				</div>
			</div>
			<div v-show="metadataVisible" class="catalog-metadata">
				<el-form :disabled="!editable" label-position="top" class="q-grid" @submit.prevent>
					<el-form-item label="指标名称"><el-input v-model="editing.body.name" /></el-form-item>
					<el-form-item label="生效日期"
						><el-date-picker v-model="editing.body.effective_from" value-format="YYYY-MM-DD" :clearable="false"
					/></el-form-item>
					<el-form-item label="失效日期（可留空）"
						><el-date-picker v-model="editing.body.effective_to" value-format="YYYY-MM-DD" @change="editing.body.effective_to ||= ''"
					/></el-form-item>
					<el-form-item label="来源"><el-input v-model="editing.body.source" /></el-form-item>
				</el-form>
			</div>
		</section>
		<div v-show="versionHistoryVisible || !editing" class="catalog-versions">
			<div class="q-section-head">
				<h3>设备指标版本</h3>
				<el-button v-if="canManage" @click="seed">从已核对源表建立草稿</el-button>
			</div>
			<el-table :data="catalogs" class="q-table" style="margin-top: 18px" @row-click="select">
				<el-table-column label="指标名称" min-width="210"
					><template #default="{ row }"
						><el-button link type="primary" @click.stop="select(row)">{{ row.body.name }}</el-button></template
					></el-table-column
				>
				<el-table-column prop="version" label="版本" width="70" />
				<el-table-column label="状态" width="100"
					><template #default="{ row }">{{ stateLabels[row.status] }}</template></el-table-column
				>
				<el-table-column label="选型 / 电机价格" min-width="180"
					><template #default="{ row }">{{ row.body.fan_points.length }} 条工况 / {{ row.body.motors.length }} 条电机</template></el-table-column
				>
				<el-table-column label="生效日期" min-width="160"
					><template #default="{ row }">{{ row.body.effective_from }}</template></el-table-column
				>
			</el-table>
		</div>
		<div v-if="editing" class="catalog-layout">
			<nav class="catalog-directory" aria-label="设备产品目录">
				<p class="catalog-directory-label">产品目录</p>
				<div v-for="group in productDirectory" :key="group.id" class="catalog-product-group">
					<button type="button" class="catalog-group-button" :aria-expanded="expandedGroup === group.id" @click="chooseGroup(group.id)">
						{{ group.label }}<span aria-hidden="true">{{ expandedGroup === group.id ? '⌄' : '›' }}</span>
					</button>
					<div v-show="expandedGroup === group.id" class="catalog-product-list">
						<button
							v-for="product in group.products"
							:key="product.id"
							type="button"
							:aria-current="selectedProduct === product.id ? 'page' : undefined"
							@click="chooseProduct(product.id)"
						>
							{{ product.label }}
						</button>
					</div>
				</div>
				<button type="button" class="catalog-shared-button" :aria-current="isShared ? 'page' : undefined" @click="chooseProduct('shared')">
					共用报价设置
				</button>
			</nav>
			<div class="catalog-product-content">
				<p class="q-muted catalog-breadcrumb">设备指标 / {{ isShared ? '共用设置' : currentGroup?.label }}</p>
				<div class="q-section-head">
					<h2>{{ isShared ? '共用报价设置' : currentProduct?.label }}</h2>
					<el-tag effect="plain" type="info">{{ isShared ? '本版本共用' : '产品指标' }}</el-tag>
				</div>
				<div v-if="selectedProduct === 'fire'" class="catalog-temperature">
					<span>温度规格</span
					><el-radio-group v-model="temperature" aria-label="防火阀温度规格"
						><el-radio-button label="70">70°</el-radio-button><el-radio-button label="150">150°</el-radio-button
						><el-radio-button label="280">280°</el-radio-button></el-radio-group
					><span class="q-muted">70°和280°共用普通材料指标</span>
				</div>
				<p v-if="selectedProduct === 'pressure_relief'" class="catalog-notice">余压阀按对应规格防火阀计算成本，下列基础参数与防火阀共用。</p>
				<div v-if="selectedProduct === 'fire_outlet'" class="catalog-notice">
					防火风口按组合规则使用阀门、百叶及面板成本。<el-button link type="primary" @click="chooseGroup('valves')">查看防火阀指标</el-button
					><el-button link type="primary" @click="chooseGroup('outlets')">查看风口指标</el-button>
				</div>
				<el-empty v-if="selectedProduct === 'slide'" description="尚无独立插板阀成本指标，需补齐资料并确认计价规则。" :image-size="65" />
				<template v-for="section in rateSections">
					<section v-if="section.keys.length" :key="section.id" class="catalog-product-section" :aria-label="section.label">
						<div class="q-section-head">
							<h3>{{ section.label }}</h3>
							<el-button v-if="section.id === 'structure'" link type="primary" @click="structureVisible = !structureVisible">{{
								structureVisible ? '收起' : '展开计算参数'
							}}</el-button>
							<el-button
								v-if="section.scope && editable && !editingGroups.includes(section.id) && (section.id !== 'structure' || structureVisible)"
								link
								type="primary"
								@click="editingGroups.push(section.id)"
								>修改共用指标</el-button
							>
						</div>
						<div v-show="section.id !== 'structure' || structureVisible">
							<p v-if="section.scope" class="catalog-scope">共用范围：{{ section.scope }}</p>
							<el-form
								:disabled="!editable || (!!section.scope && !editingGroups.includes(section.id))"
								label-position="top"
								class="catalog-fields"
								@submit.prevent
							>
								<el-form-item v-for="key in section.keys" :key="key" :label="equipmentRates[key] || key"
									><el-input
										:model-value="
											Object.prototype.hasOwnProperty.call(editing.body.rates, key) ? editing.body.rates[key] : mechanismRateDefaults[key]
										"
										@update:model-value="editing.body.rates[key] = $event"
										:readonly="key === 'check_splice'"
										:aria-label="equipmentRates[key] || key"
										:placeholder="fire150PriceKeys.includes(key) ? '待确认，请填写专用吨价' : ''"
										inputmode="decimal"
								/></el-form-item>
							</el-form>
							<p v-if="section.note" class="catalog-rule-note">{{ section.note }}</p>
						</div>
					</section>
				</template>
				<section v-if="isAcoustic" class="catalog-product-section" aria-label="消声设备地区成本">
					<el-collapse v-model="acousticExpanded" @change="acousticExpanded.includes('acoustic') && loadAcousticReference()">
						<el-collapse-item title="消声器、静压箱成本设置" name="acoustic">
							<div class="q-section-head">
								<span>{{
									editing.body.acoustic_region_costs ? (editable ? '草稿价格 · 发布后生效' : '本版本地区价格') : '地区参考价格 · 待启用'
								}}</span>
								<el-button v-if="canManage && !editing.body.acoustic_region_costs" type="primary" :disabled="busy" @click="editAcousticCosts">
									{{ editable ? '启用地区成本' : '创建新版本并启用地区成本' }}
								</el-button>
								<el-button v-else-if="canManage && !editable" type="primary" :disabled="busy" @click="editAcousticCosts">创建新版本并编辑</el-button>
							</div>
							<p class="q-muted">未税成本（元/㎡），未含利润和运费。单层按项目所在省份取价，双层不分地区，价格与计算参数统一在此维护。</p>
							<p v-if="!canManage" class="q-muted">当前账号仅可查看，请由有报价管理权限的人员修改。</p>
							<p v-else-if="!editable" class="q-muted">此版本只读，点击右侧按钮创建草稿后即可修改。</p>
							<p v-if="!editing.body.acoustic_region_costs" class="q-muted">
								下表为待启用的地区参考价，不参与当前版本报价。当前单层统一成本：消声器 {{ editing.body.rates.silencer_rate }} 元/㎡，静压箱
								{{ editing.body.rates.plenum_rate }} 元/㎡。
							</p>
							<p v-if="acousticReferenceError && !editing.body.acoustic_region_costs" role="alert">
								地区参考价格加载失败，请重试。<el-button link type="primary" @click="loadAcousticReference">重新加载</el-button>
							</p>
							<el-table
								v-loading="acousticReferenceLoading && !editing.body.acoustic_region_costs"
								:data="acousticCosts"
								class="q-table"
								style="margin-bottom: 20px"
							>
								<el-table-column prop="region" label="地区" min-width="100" />
								<el-table-column v-if="selectedProduct === 'silencer'" label="单层消声器（元/㎡）" min-width="180"
									><template #default="{ row }"
										><el-input
											v-if="editable && editing.body.acoustic_region_costs && row.cost"
											v-model="row.cost.silencer"
											:aria-label="row.region + '单层消声器成本'"
											inputmode="decimal"
										/><span v-else>{{ row.cost?.silencer ?? '—' }}</span></template
									></el-table-column
								>
								<el-table-column v-if="selectedProduct === 'plenum'" label="单层静压箱（元/㎡）" min-width="180"
									><template #default="{ row }"
										><el-input
											v-if="editable && editing.body.acoustic_region_costs && row.cost"
											v-model="row.cost.plenum"
											:aria-label="row.region + '单层静压箱成本'"
											inputmode="decimal"
										/><span v-else>{{ row.cost?.plenum ?? '—' }}</span></template
									></el-table-column
								>
							</el-table>
							<el-form :disabled="!editable" label-position="top" class="q-grid" @submit.prevent>
								<el-form-item :label="equipmentRates.double_layer_rate">
									<el-input v-model="editing.body.rates.double_layer_rate" :aria-label="equipmentRates.double_layer_rate" inputmode="decimal" />
								</el-form-item>
							</el-form>
							<el-collapse>
								<el-collapse-item title="其他计算参数" name="acoustic-parameters">
									<el-form :disabled="!editable" label-position="top" class="q-grid" @submit.prevent>
										<el-form-item v-for="key in acousticParameterKeys" :key="key" :label="equipmentRates[key] || key">
											<el-input v-model="editing.body.rates[key]" :aria-label="equipmentRates[key] || key" inputmode="decimal" />
										</el-form-item>
									</el-form>
								</el-collapse-item>
							</el-collapse>
							<p v-if="editable" class="q-muted">修改后请保存草稿、校验并发布，报价才会使用新版本。</p>
						</el-collapse-item>
					</el-collapse>
				</section>
				<section v-show="showParameters" class="catalog-product-section">
					<div class="q-section-head">
						<h3>{{ currentProduct?.fan ? '本体参数与选型' : currentProduct?.louvers ? '风口成本与附件规格' : '基础机构与结构参数' }}</h3>
						<el-button v-if="currentProduct?.fan && editable" :disabled="busy" @click="updateFanData">应用新版风机区间及成本</el-button>
						<el-button v-if="currentProduct?.louvers && editable" @click="supplementLouvers">应用最新百叶成本</el-button>
					</div>
					<p v-if="currentProduct?.louvers" class="catalog-scope">百叶调价将同时更新单层、双层、防雨、自垂四种普通百叶的面积成本。</p>
					<p v-if="currentProduct?.fan" class="catalog-scope">新版数据会同时更新 HTFC、HTF、SWF 三个系列及共用电机价格，保存并发布后用于报价。</p>
					<p v-if="currentProduct?.fan && editing.body.fan_coverage_note" class="catalog-scope">{{ editing.body.fan_coverage_note }}</p>
					<EquipmentParameters
						:key="editing.id + ':' + editing.revision"
						:catalog="editing.body"
						:editable="editable"
						:product="currentProduct"
						:initial-section="selectedProduct === props.initialProduct ? props.initialSection : undefined"
						@pending-change="pendingParameterChange = $event"
					/>
				</section>
				<section v-if="selectedPriceGroups.length" class="catalog-product-section" aria-label="材料与采购价格">
					<h3>{{ !showParameters ? '外购型号与价格' : '材料、电机与采购价格' }}</h3>
					<p v-if="showParameters" class="catalog-scope">共用板材表适用于按材质、板厚取价的产品；电机表由风机系列共用，修改会同步影响引用产品。</p>
					<el-collapse v-model="priceExpanded"
						><el-collapse-item
							v-for="group in selectedPriceGroups"
							:key="group.key"
							:name="group.key"
							:title="group.label + ' · ' + priceRows(group.key).length + ' 条'"
						>
							<div v-if="group.key === 'purchased' && selectedProduct === 'ventilator'" class="q-section-head">
								<p class="q-muted">换气扇表为对客含税售价，已除以 1.1 保存为不含税售价，不再加毛利；仍按本单税费、运费和付款条件报价。</p>
								<el-button v-if="editable" @click="supplementVentilators">补入换气扇价格表</el-button>
							</div>
							<p v-if="group.key === 'purchased' && selectedProduct === 'ventilator'" class="q-muted">
								换气扇未指定材质时优先选塑料；塑料不满足时，只有全金属或半金属一种符合则自动选型，两种都符合才人工选择。明确指定材质时不自动替换。有型号按型号匹配；无型号时风量须达标，有功率再选最接近的合格功率档位，否则选最接近的合格风量档位。风压不参与选型。
							</p>
							<el-table :data="priceRows(group.key)" max-height="480" class="q-table" empty-text="此版本暂无对应价格，请补齐资料后再报价">
								<el-table-column label="材质 / 型号" min-width="200"
									><template #default="{ row }"
										>{{ row.model || row.material }} {{ row.thickness ? row.thickness + 'mm' : '' }}</template
									></el-table-column
								>
								<el-table-column label="名称 / 功率 / 极数" min-width="200"
									><template #default="{ row }">{{
										row.name || (row.powers ? [row.powers.join('/') + ' kW', row.poles?.join('/') + ' 极'].join(' · ') : '板材')
									}}</template></el-table-column
								>
								<el-table-column v-if="group.key === 'purchased'" label="价格口径" width="180">
									<template #default="{ row }"
										>{{ row.price_basis === 'sale' ? '不含税售价（不再加毛利）' : '不含税采购成本' }} / {{ row.unit }}</template
									>
								</el-table-column>
								<el-table-column
									:label="group.key === 'materials' ? '吨价（元/吨）' : group.key === 'purchased' ? '不含税单价（元）' : '不含税成本（元）'"
									width="190"
									><template #default="{ row }"
										><el-input
											v-model="row[group.key === 'purchased' && row.price_basis === 'sale' ? 'sale_price' : group.price]"
											:disabled="!editable" /></template
								></el-table-column>
								<el-table-column v-if="group.key === 'purchased'" label="风量（m³/h）" min-width="155">
									<template #default="{ row }"><el-input v-model="row.airflow" :disabled="!editable" placeholder="待补充" /></template>
								</el-table-column>
								<el-table-column v-if="group.key === 'purchased'" label="风压（Pa，仅参考）" min-width="170">
									<template #default="{ row }"><el-input v-model="row.pressure" :disabled="!editable" placeholder="不参与选型，可留空" /></template>
								</el-table-column>
								<el-table-column v-if="group.key === 'purchased'" label="功率（W）" min-width="140">
									<template #default="{ row }"><el-input v-model="row.power" :disabled="!editable" placeholder="待补充" /></template>
								</el-table-column>
								<el-table-column v-if="group.key === 'purchased'" prop="source_taxed_price" label="源表含税售价" width="140" />
								<el-table-column prop="source" label="来源单元格" min-width="220" />
							</el-table> </el-collapse-item
					></el-collapse>
				</section>
				<section v-if="isShared" class="catalog-product-section">
					<h3>运费与付款条件</h3>
					<el-form :disabled="!editable" label-position="top" class="q-grid" @submit.prevent>
						<el-form-item v-for="(_, region) in editing.body.regions" :key="region" :label="region + '运费系数'"
							><el-input v-model="editing.body.regions[region]"
						/></el-form-item>
						<el-form-item v-for="term in editing.body.payment_terms" :key="term.code" :label="term.label"
							><el-input v-model="term.coefficient"
						/></el-form-item>
					</el-form>
				</section>
				<details class="catalog-advanced">
					<summary>高级公式与来源记录</summary>
					<p v-if="visibleFormulas.length" class="catalog-scope">结构公式由引用这些公式的产品共用，修改会影响相关产品的成本。</p>
					<el-form v-if="visibleFormulas.length" :disabled="!editable" label-position="top" @submit.prevent
						><section v-for="key in visibleFormulas" :key="key" class="q-formula">
							<el-form-item :label="equipmentComponents[key] || key"><el-input v-model="editing.body.valve_expressions[key]" /></el-form-item>
							<p class="q-formula-preview"><span>中文对照</span>{{ chineseFormula(editing.body.valve_expressions[key]) }}</p>
						</section></el-form
					>
					<el-table v-if="visibleFormulas.length" :data="Object.entries(equipmentVariables).map(([key, label]) => ({ key, label }))" class="q-table"
						><el-table-column prop="key" label="英文参数" /><el-table-column prop="label" label="中文含义 / 单位"
					/></el-table>
					<p v-if="editing.body.rates.fire_150_steel" class="q-muted">
						旧150°防火阀材料吨价：{{ editing.body.rates.fire_150_steel }}元/吨（材质未确认，仅供历史参考，不参与报价）。
					</p>
					<el-table :data="editing.body.source_files" class="q-table"
						><el-table-column prop="name" label="源文件" min-width="230" /><el-table-column prop="sha256" label="文件 SHA-256" min-width="420"
					/></el-table>
					<p v-if="isShared" class="q-muted">
						历史指标（只读）：<span v-for="key in historicalRateKeys.filter((key) => key !== 'fire_150_steel')" :key="key"
							>{{ equipmentRates[key] }}：{{ editing.body.rates[key] || '未记录' }}；</span
						>
					</p>
				</details>
			</div>
		</div>
		<p v-if="editing" class="catalog-footer">各产品共用当前设备指标版本，修改后请保存、校验并发布；安装价格在安装指标中维护。</p>
	</div>
</template>
<script setup lang="ts">
/** 设备指标维护面板：从已核对基准数据准备草稿，负责人保存、校验和发布版本；已发布指标只读，调价通过新版本执行。 */
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { ElMessage } from 'element-plus';
import { auth } from '/@/utils/authFunction';
import { quoteApi } from '/@/api/quotation';
import { confirm, report, stateLabels } from '/@/views/quotation/shared';
import { equipmentRates, equipmentComponents, equipmentVariables, equipmentFormulaInChinese as chineseFormula } from '/@/views/quotation/equipment';
import EquipmentParameters from './EquipmentParameters.vue';
import { mergeVentilatorPrices } from './purchasedPrices';
import {
	productDirectory,
	catalogProducts,
	productRateSections,
	extraRateKeys,
	purchasedProduct,
	fanProduct,
	formulaKeys,
	fire150PriceKeys,
	historicalRateKeys,
	mechanismRateDefaults,
	type ProductRateSection,
} from './productDirectory';
import type { Catalog, EquipmentCatalogBody } from '/@/types/quotation';
type EquipmentCatalog = Catalog<EquipmentCatalogBody>;
const props = defineProps<{ initialProduct?: string; initialSection?: string }>();
/** 设备指标版本列表与 editing 编辑副本分开保存；baseline 用于发现未保存修改，避免直接污染列表或历史版本。 */
const catalogs = ref<EquipmentCatalog[]>([]),
	editing = ref<EquipmentCatalog>(),
	busy = ref(false),
	baseline = ref('');
const initialProduct = catalogProducts.find((product) => product.id === props.initialProduct)?.id || 'fire';
const selectedProduct = ref(initialProduct),
	expandedGroup = ref(productDirectory.find((group) => group.products.some((product) => product.id === initialProduct))!.id),
	temperature = ref('150');
const versionHistoryVisible = ref(false),
	metadataVisible = ref(false),
	editingGroups = ref<string[]>([]);
const structureVisible = ref(false);
const currentProduct = computed(() => catalogProducts.find((p) => p.id === selectedProduct.value));
const currentGroup = computed(() => productDirectory.find((g) => g.products.some((p) => p.id === selectedProduct.value)));
const isShared = computed(() => selectedProduct.value === 'shared');
const isAcoustic = computed(() => ['silencer', 'plenum'].includes(selectedProduct.value));
const isValve = computed(() => !!currentProduct.value?.valves);
const hasFanParameters = computed(
	() =>
		!!currentProduct.value?.fan &&
		[...(editing.value?.body.fan_bodies || []), ...(editing.value?.body.fan_points || [])].some(
			(row) => fanProduct(row.family) === selectedProduct.value
		)
);
const showParameters = computed(() => !!(currentProduct.value?.valves || currentProduct.value?.louvers || hasFanParameters.value));
const priceExpanded = ref<string[]>([]);
const rateSections = computed<ProductRateSection[]>(() =>
	isShared.value
		? [
				{ id: 'pricing', label: '毛利、税费与运费门槛', keys: ['gross_margin', 'tax_factor', 'freight_threshold'], scope: '本版本的设备报价共用。' },
				{ id: 'other', label: '其他已录入参数', keys: extraRateKeys(editing.value?.body.rates || {}) },
		  ]
		: productRateSections(selectedProduct.value, temperature.value)
);
const visibleFormulas = computed(() =>
	isShared.value
		? Object.keys(editing.value?.body.valve_expressions || {})
		: isValve.value
		? formulaKeys(selectedProduct.value, Object.keys(editing.value?.body.valve_expressions || {}))
		: []
);
const purchasedRows = computed(() => (editing.value?.body.purchased || []).filter((row) => purchasedProduct(row) === selectedProduct.value));
const selectedPriceGroups = computed(() =>
	priceGroups.filter((g) =>
		g.key === 'materials'
			? isValve.value && !(selectedProduct.value === 'fire' && temperature.value === '150')
			: g.key === 'motors'
			? hasFanParameters.value
			: purchasedRows.value.length > 0 ||
			  ['fan_other', 'ventilator', 'cabinet', 'damper', 'connector', 'other_purchased'].includes(selectedProduct.value)
	)
);

function priceRows(key: 'materials' | 'motors' | 'purchased') {
	return key === 'purchased' ? purchasedRows.value : editing.value!.body[key];
}
function chooseProduct(id: string) {
	selectedProduct.value = id;
	editingGroups.value = [];
}
function chooseGroup(id: string) {
	expandedGroup.value = id;
	chooseProduct(productDirectory.find((g) => g.id === id)!.products[0].id);
}
watch(isAcoustic, (active) => {
	if (active) {
		acousticExpanded.value = ['acoustic'];
		void loadAcousticReference();
	}
});
/** 子参数弹窗中尚未应用的修改也计入 dirty，防止只比较主表正文时遗漏未保存的工况输入。 */
const pendingParameterChange = ref(false);
/** 只有具备 quote_manage 权限且当前为草稿时允许编辑；接口仍负责最终权限、版本及状态校验。 */
const canManage = computed(() => auth('quote_manage'));
const editable = computed(() => canManage.value && editing.value?.status === 'draft');
const snapshot = () => JSON.stringify(editing.value?.body);
const dirty = computed(() => !!editing.value && (snapshot() !== baseline.value || pendingParameterChange.value));
const basicLouverTypes = [
	['single', '单层百叶'],
	['double', '双层百叶'],
	['rain', '防雨百叶'],
	['gravity', '自垂百叶'],
];
const acousticRegions = ['贵州', '广西', '海南', '四川', '陕西', '云南'];
const acousticExpanded = ref<string[]>([]);
const acousticReference = ref<EquipmentCatalogBody['acoustic_region_costs']>();
const acousticReferenceLoading = ref(false);
const acousticReferenceError = ref(false);
const acousticCosts = computed(() => {
	const costs = editing.value?.body.acoustic_region_costs ?? acousticReference.value;
	return costs ? acousticRegions.map((region) => ({ region, cost: costs[region] })) : [];
});
const acousticParameterKeys = ['silencer_edge', 'thickness_1_factor', 'thickness_1_2_factor', 'angle_factor'];
// 参考表与版本正文隔离，展开查看不会把价格写入历史版本或产生未保存修改。
async function loadAcousticReference() {
	if (!editing.value || editing.value.body.acoustic_region_costs || acousticReference.value || acousticReferenceLoading.value) return;
	acousticReferenceLoading.value = true;
	acousticReferenceError.value = false;
	try {
		acousticReference.value = await quoteApi.acousticRegionCosts();
	} catch {
		acousticReferenceError.value = true;
	} finally {
		acousticReferenceLoading.value = false;
	}
}
watch(editing, () => {
	if (acousticExpanded.value.includes('acoustic')) void loadAcousticReference();
});
const priceGroups = [
	{ key: 'materials' as const, label: '不锈钢板材吨价', price: 'ton_price' },
	{ key: 'motors' as const, label: '电机成本', price: 'cost' },
	{ key: 'purchased' as const, label: '外购设备', price: 'cost' },
];
watch(
	[selectedProduct, hasFanParameters],
	() => {
		priceExpanded.value = !showParameters.value && selectedPriceGroups.value.some((group) => group.key === 'purchased') ? ['purchased'] : [];
	},
	{ immediate: true }
);
/** 深拷贝选中指标并建立基线，保证表单修改只作用于当前编辑副本。 */
function setEditing(item?: EquipmentCatalog) {
	editing.value = item ? JSON.parse(JSON.stringify(item)) : undefined;
	pendingParameterChange.value = false;
	editingGroups.value = [];
	baseline.value = snapshot();
}
/** 查询资源后仅保留设备指标，优先重新选中指定版本，再更新编辑副本与保存基线。 */
async function reload(id?: string) {
	catalogs.value = (await quoteApi.resources<EquipmentCatalogBody>()).filter((c) => c.kind === 'equipment_catalog');
	setEditing(catalogs.value.find((c) => c.id === id) || catalogs.value[0]);
}
/** 存在未保存的设备指标修改时确认是否放弃；取消返回 false，保持当前表单。 */
async function leave() {
	if (!dirty.value) return true;
	try {
		await confirm('设备指标有未保存修改，确定放弃？');
		return true;
	} catch {
		return false;
	}
}
/** 切换指标版本前处理未保存修改，确认后才替换当前编辑副本。 */
async function select(item: EquipmentCatalog) {
	if (await leave()) setEditing(item);
}
/** 复用已有设备草稿，或读取已核对源表数据建立未持久化编辑副本；此动作不会直接发布价格。 */
async function seed() {
	if (!(await leave())) return;
	busy.value = true;
	try {
		const draft = catalogs.value.find((c) => c.status === 'draft');
		if (draft) setEditing(draft);
		else {
			setEditing({ id: '', family: '', kind: 'equipment_catalog', version: 1, revision: 0, status: 'draft', body: await quoteApi.equipmentSeed() });
			baseline.value = '';
		}
	} catch (e) {
		report(e);
	} finally {
		busy.value = false;
	}
}
/** 将新价补入当前编辑草稿；保存、校验和发布继续使用现有版本流程。 */
async function supplementVentilators() {
	if (!editing.value || !editable.value) return;
	busy.value = true;
	try {
		const merged = mergeVentilatorPrices(editing.value.body, await quoteApi.equipmentSeed());
		if (!merged.count) throw new Error('当前后端尚未提供这批换气扇价格，请先更新后端');
		editing.value.body.purchased = merged.purchased;
		editing.value.body.source_files = merged.source_files;
		ElMessage.success(`已补入 ${merged.count} 条换气扇不含税售价，请保存、校验并发布指标`);
	} catch (e) {
		report(e);
	} finally {
		busy.value = false;
	}
}

/** 整批替换三类风机及电机数据，保留同版本的其他设备指标。 */
async function updateFanData() {
	if (!editing.value || !editable.value || busy.value) return;
	const target = editing.value;
	busy.value = true;
	try {
		const source = await quoteApi.equipmentSeed();
		if (source.fan_selection !== 'range-v1' || !source.fan_points.length) throw new Error('后端尚未提供新版风机数据');
		if (editing.value !== target) return;
		Object.assign(target.body, JSON.parse(JSON.stringify({
			fan_points: source.fan_points, fan_bodies: source.fan_bodies, motors: source.motors,
			fan_selection: source.fan_selection, fan_data_batch: source.fan_data_batch,
			fan_source_files: source.fan_source_files, fan_coverage_note: source.fan_coverage_note,
		})));
		ElMessage.success('已应用新版风机区间、本体公式及电机价格，请保存、校验并发布指标');
	} catch (e) {
		report(e);
	} finally {
		busy.value = false;
	}
}
/** 将已确认的四种普通百叶面积成本补入当前草稿，仍通过原指标版本流程保存和发布。 */
async function supplementLouvers() {
	if (!editing.value || !editable.value || busy.value) return;
	const target = editing.value;
	busy.value = true;
	try {
		const seed = await quoteApi.equipmentSeed();
		if (!seed.louver_price_batch) throw new Error('当前后端尚未提供最新百叶成本，请先更新后端');
		const incoming = basicLouverTypes.map(([key]) => {
			const rate = seed.louvers[key]?.[0];
			if (!rate || !Number.isFinite(Number(rate)) || Number(rate) < 0) throw new Error('最新百叶成本指标不完整，请先更新后端');
			return { key, rate };
		});
		if (editing.value !== target) return;
		for (const { key, rate } of incoming) target.body.louvers[key][0] = rate;
		target.body.louver_price_batch = seed.louver_price_batch;
		ElMessage.success('已更新四种百叶面积成本，请保存、校验并发布指标');
	} catch (e) {
		report(e);
	} finally {
		busy.value = false;
	}
}
/** 从当前只读版本创建草稿；仅尚无地区表时补入已确认成本，避免覆盖已维护的价格。 */
async function editAcousticCosts() {
	if (!canManage.value || !editing.value || busy.value) return;
	if (!editable.value) await act('revise');
	if (editable.value && !editing.value?.body.acoustic_region_costs) await supplementAcousticCosts();
}
/** 仅首次补入地区成本表，保留原双层价格和其他成本参数。 */
async function supplementAcousticCosts() {
	if (!editing.value || !editable.value || busy.value || editing.value.body.acoustic_region_costs) return;
	const target = editing.value;
	busy.value = true;
	try {
		const costs = (await quoteApi.equipmentSeed()).acoustic_region_costs;
		if (
			!costs ||
			acousticRegions.some((region) =>
				['silencer', 'plenum'].some((kind) => {
					const value = costs[region]?.[kind as 'silencer' | 'plenum'];
					return value == null || String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value) < 0;
				})
			)
		)
			throw new Error('后端未提供完整的地区成本，请先更新后端');
		if (editing.value !== target) return;
		target.body.acoustic_region_costs = JSON.parse(JSON.stringify(costs));
		ElMessage.success('已应用单层地区成本，双层价格未改动，请保存、校验并发布指标');
	} catch (e) {
		report(e);
	} finally {
		busy.value = false;
	}
}
/** 已有设备指标按 revision 保存，新建源表副本先创建资源；成功后重新读取版本，更新并发修订号和基线。 */
async function save() {
	if (!editing.value) return;
	busy.value = true;
	try {
		let id = editing.value.id;
		if (id) await quoteApi.saveResource(editing.value);
		else id = (await quoteApi.createResource(editing.value.body, 'equipment_catalog')).id;
		await reload(id);
		ElMessage.success('设备指标草稿已保存');
	} catch (e) {
		report(e);
	} finally {
		busy.value = false;
	}
}
/** 携带当前修订号执行设备指标校验、发布、修订、停用等生命周期动作，完成后刷新相应版本。 */
async function act(action: string) {
	if (!editing.value) return;
	try {
		if (action !== 'trial' && action !== 'revise')
			await confirm(
				{
					publish: '确认发布已核对的设备指标？',
					retire: '确认停用此设备指标版本？',
					reactivate: '确认重新启用此版本？',
					delete: '确认删除此指标草稿？',
				}[action] || '确认执行？'
			);
		busy.value = true;
		const result = await quoteApi.resourceAction(editing.value, action);
		if (action !== 'trial') await reload(result.id || editing.value.id);
		ElMessage.success(result.message || '设备指标操作完成');
	} catch (e) {
		report(e);
	} finally {
		busy.value = false;
	}
}
/** 页面关闭或刷新时，对尚未保存的指标修改触发浏览器离开提示。 */
function beforeUnload(event: BeforeUnloadEvent) {
	if (dirty.value) {
		event.preventDefault();
		event.returnValue = '';
	}
}
onBeforeRouteLeave(leave);
onMounted(async () => {
	window.addEventListener('beforeunload', beforeUnload);
	try {
		await reload();
	} catch (e) {
		report(e);
	}
});
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload));
</script>
