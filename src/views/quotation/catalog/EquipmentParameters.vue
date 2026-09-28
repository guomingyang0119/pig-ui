<template>
	<div class="equipment-parameters">
		<p class="parameter-intro">这里维护报价使用的基础参数。日常报价请在工作台填写客户需求；本页修改先保存为草稿，校验并发布后才用于新试算。</p>
		<el-tabs v-model="section">
			<el-tab-pane label="阀门参数" name="valves" lazy>
				<p class="parameter-help">按阀门类型维护机构成本、叶片厚度和人工费。板式排烟口的近控、远控、自动机构成本在「供货价格与边界」中维护。</p>
				<el-table :data="valves" class="q-table" row-key="key">
					<el-table-column prop="label" label="阀门类型" min-width="220" />
					<el-table-column v-for="field in valveFields" :key="field.key" :label="field.label" min-width="180">
						<template #default="{ row }"
							><el-input v-model="row.value[field.key]" :disabled="!editable" :aria-label="row.label + ' · ' + field.label"
						/></template>
					</el-table-column>
				</el-table>
			</el-tab-pane>
			<el-tab-pane label="风口参数" name="louvers" lazy>
				<p class="parameter-help">
					风口成本取「面积 × 每平方米成本 × 附件倍率」与「最低成本」中的较大值。尺寸增加值分别加到宽和高；散流器按喉部尺寸报价时，沿用已确认的 130 mm
					换算规则。
				</p>
				<el-table :data="louvers" class="q-table" row-key="key">
					<el-table-column prop="label" label="风口类型" min-width="210" />
					<el-table-column v-for="(label, index) in louverFields" :key="label" :label="label" min-width="170">
						<template #default="{ row }"
							><el-input v-model="row.value[index]" :disabled="!editable" :aria-label="row.label + ' · ' + label"
						/></template>
					</el-table-column>
				</el-table>
			</el-tab-pane>
			<el-tab-pane label="风机本体" name="bodies" lazy>
				<p class="parameter-help">按系列和机号维护机壳材料成本及其他成本。电机单独按实际功率和极数查价；公式中的变量有中文对照。</p>
				<div class="parameter-toolbar">
					<el-input v-model="bodySearch" clearable placeholder="搜索系列、机号或来源" aria-label="搜索风机本体" class="parameter-search" />
					<el-button v-if="editable" type="primary" @click="editBody()">新增本体参数</el-button>
				</div>
				<el-table :data="bodies" class="q-table" row-key="id" max-height="560">
					<el-table-column label="系列" min-width="190"
						><template #default="{ row }">{{ familyLabel(row.family) }}</template></el-table-column
					>
					<el-table-column prop="size" label="机号" width="80" />
					<el-table-column prop="steel_price" label="材料吨价（元/吨）" width="160" />
					<el-table-column label="板厚（mm）" width="110"
						><template #default="{ row }">{{ row.thickness || '未指定' }}</template></el-table-column
					>
					<el-table-column prop="source" label="依据来源" min-width="260" show-overflow-tooltip />
					<el-table-column label="操作" width="135" fixed="right"
						><template #default="{ row }">
							<el-button link type="primary" @click="editBody(row)">{{ editable ? '编辑' : '查看' }}</el-button>
							<el-button v-if="editable" link type="danger" @click="removeEntry('fan_bodies', row.id)">移除</el-button>
						</template></el-table-column
					>
				</el-table>
				<p class="parameter-help">共 {{ bodies.length }} 条本体参数。</p>
			</el-tab-pane>
			<el-tab-pane label="风机工况" name="points" lazy>
				<p class="parameter-help">工况是一台风机在指定转速下的风量、风压和功率组合，系统据此选型。「隔离」的记录保留备查，不参与选型。</p>
				<div class="parameter-toolbar">
					<el-input v-model="pointSearch" clearable placeholder="搜索型号、机号或来源" aria-label="搜索风机工况" class="parameter-search" />
					<el-select v-model="familyFilter" clearable placeholder="全部风机系列" aria-label="筛选风机系列" class="parameter-filter">
						<el-option v-for="family in families" :key="family.value" :value="family.value" :label="family.label" />
					</el-select>
					<el-checkbox v-model="onlyQuarantined">只看隔离工况</el-checkbox>
					<el-button v-if="editable" type="primary" @click="editPoint()">新增工况</el-button>
				</div>
				<el-table :data="pointPage" class="q-table" row-key="id" empty-text="没有符合条件的工况，请调整搜索条件">
					<el-table-column prop="model" label="型号" min-width="150" />
					<el-table-column prop="airflow" label="风量（m³/h）" min-width="120" />
					<el-table-column prop="pressure" label="风压（Pa）" min-width="105" />
					<el-table-column label="功率（kW）" min-width="125"
						><template #default="{ row }">{{ row.powers.join(' / ') }}</template></el-table-column
					>
					<el-table-column prop="speed" label="转速（r/min）" min-width="125" />
					<el-table-column label="状态" width="110"
						><template #default="{ row }"
							><el-tag :type="row.quarantined ? 'warning' : 'info'" effect="plain">{{ row.quarantined ? '已隔离' : '参与选型' }}</el-tag></template
						></el-table-column
					>
					<el-table-column label="操作" width="135" fixed="right"
						><template #default="{ row }">
							<el-button link type="primary" @click="editPoint(row)">{{ editable ? '编辑' : '查看' }}</el-button>
							<el-button v-if="editable" link type="danger" @click="removeEntry('fan_points', row.id)">移除</el-button>
						</template></el-table-column
					>
				</el-table>
				<div class="parameter-pagination">
					<span class="q-muted">找到 {{ points.length }} 条 / 全部 {{ catalog.fan_points.length }} 条</span>
					<el-pagination v-model:current-page="page" :page-size="pageSize" :total="points.length" :pager-count="5" layout="prev, pager, next" />
				</div>
			</el-tab-pane>
			<el-tab-pane label="防爆分档" name="explosion" lazy>
				<p class="parameter-help">以普通风机不含税成本判断档位，乘以下面的防爆倍率后再计算供货价。最后一档没有上限。</p>
				<el-table :data="catalog.explosion_tiers" class="q-table">
					<el-table-column label="成本范围（元）" min-width="230"
						><template #default="{ row, $index }">{{ tierRange($index, row.limit) }}</template></el-table-column
					>
					<el-table-column label="成本上限（元，包含本数）" min-width="225"
						><template #default="{ row, $index }">
							<span v-if="row.limit === null">无上限</span
							><el-input v-else v-model="row.limit" :disabled="!editable" :aria-label="'第' + ($index + 1) + '档成本上限（元）'" /> </template
					></el-table-column>
					<el-table-column label="防爆成本倍率" min-width="175"
						><template #default="{ row, $index }"
							><el-input v-model="row.factor" :disabled="!editable" :aria-label="'第' + ($index + 1) + '档防爆成本倍率'" /></template
					></el-table-column>
					<el-table-column v-if="editable" label="操作" width="100"
						><template #default="{ $index }"
							><el-button v-if="$index < catalog.explosion_tiers.length - 1" link type="danger" @click="removeTier($index)">移除</el-button></template
						></el-table-column
					>
				</el-table>
				<el-button
					v-if="editable"
					class="parameter-add"
					@click="catalog.explosion_tiers.splice(catalog.explosion_tiers.length - 1, 0, { limit: '', factor: '' })"
					>新增成本档位</el-button
				>
			</el-tab-pane>
		</el-tabs>
		<el-dialog
			v-model="editorVisible"
			:title="editorTitle"
			width="min(820px, 94vw)"
			append-to-body
			:close-on-click-modal="false"
			:before-close="closeEditor"
		>
			<div class="equipment-parameter-editor">
				<p class="parameter-help">
					{{ editable ? '应用后暂存到当前指标，仍需在指标页保存草稿、校验并发布。' : '此版本只读。需要调整时，请先创建新版本。' }}
				</p>
				<el-form v-if="pointEditor" :disabled="!editable" label-position="top" class="parameter-grid" @submit.prevent>
					<el-form-item label="风机型号"><el-input v-model="pointEditor.model" /></el-form-item>
					<el-form-item label="风机系列"
						><el-select v-model="pointEditor.family"
							><el-option v-for="family in families" :key="family.value" :value="family.value" :label="family.label" /></el-select
					></el-form-item>
					<el-form-item label="机号"><el-input v-model="pointEditor.size" /></el-form-item>
					<el-form-item label="转速（r/min）"><el-input v-model="pointEditor.speed" /></el-form-item>
					<el-form-item label="风量（m³/h）"><el-input v-model="pointEditor.airflow" /></el-form-item>
					<el-form-item label="风压（Pa）"><el-input v-model="pointEditor.pressure" /></el-form-item>
					<el-form-item label="功率（kW，双速用 / 分隔）"><el-input v-model="powerText" placeholder="例如 3 或 3 / 2.2" /></el-form-item>
					<el-form-item label="电机极数（多档用 / 分隔）"><el-input v-model="poleText" placeholder="例如 4 或 4 / 6" /></el-form-item>
					<el-form-item label="双速组号"><el-input v-model="pointEditor.group" placeholder="沿用来源分组；无分组时留空" /></el-form-item>
					<el-form-item label="选型状态"><el-checkbox v-model="pointEditor.quarantined">隔离此工况，不参与选型</el-checkbox></el-form-item>
					<el-form-item label="低速档风量（m³/h，可留空）"><el-input v-model="pointEditor.airflow_low" /></el-form-item>
					<el-form-item label="低速档风压（Pa，可留空）"><el-input v-model="pointEditor.pressure_low" /></el-form-item>
					<el-form-item label="核对说明 / 隔离原因" class="parameter-wide"
						><el-input v-model="pointEditor.quality_note" type="textarea" :rows="2"
					/></el-form-item>
					<el-form-item label="依据来源" class="parameter-wide"
						><el-input v-model="pointEditor.source" placeholder="例如厂家参数表、工作表及单元格"
					/></el-form-item>
				</el-form>
				<el-form v-else-if="bodyEditor" :disabled="!editable" label-position="top" class="parameter-grid" @submit.prevent>
					<el-form-item label="风机系列"
						><el-select v-model="bodyEditor.family"
							><el-option v-for="family in families" :key="family.value" :value="family.value" :label="family.label" /></el-select
					></el-form-item>
					<el-form-item label="机号"><el-input v-model="bodyEditor.size" /></el-form-item>
					<el-form-item label="材料吨价（元/吨）"><el-input v-model="bodyEditor.steel_price" /></el-form-item>
					<el-form-item label="板厚（mm，可留空）"
						><el-input :model-value="bodyEditor.thickness ?? ''" @update:model-value="bodyEditor.thickness = $event === '' ? null : $event"
					/></el-form-item>
					<el-form-item v-for="field in formulaFields" :key="field.key" :label="field.label" class="parameter-wide">
						<el-input v-model="bodyEditor[field.key]" type="textarea" :rows="2" />
						<p class="parameter-formula">中文对照：{{ chineseFormula(bodyEditor[field.key]) }}</p>
					</el-form-item>
					<p class="parameter-help parameter-wide">
						公式参数：steel_price＝材料吨价（元/吨）；size＝机号；thickness＝板厚（mm）。编辑公式沿用这些参数名。
					</p>
					<el-form-item label="依据来源" class="parameter-wide"><el-input v-model="bodyEditor.source" /></el-form-item>
				</el-form>
			</div>
			<template #footer
				><el-button @click="closeEditor(() => (editorVisible = false))">{{ editable ? '取消' : '关闭' }}</el-button
				><el-button v-if="editable" type="primary" @click="applyEditor">应用到草稿</el-button></template
			>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import type { EquipmentCatalogBody, FanPoint, FanBody } from '/@/types/quotation';
import { equipmentKinds, louverLabels, equipmentFormulaInChinese as chineseFormula } from '/@/views/quotation/equipment';
import { confirm, report } from '/@/views/quotation/shared';

const props = defineProps<{ catalog: EquipmentCatalogBody; editable: boolean }>();
const emit = defineEmits<{ (e: 'pending-change', value: boolean): void }>();
const section = ref('valves'),
	bodySearch = ref(''),
	pointSearch = ref(''),
	familyFilter = ref(''),
	onlyQuarantined = ref(false),
	page = ref(1);
const pageSize = 15;
const families = [
	{ value: 'HTFC', label: 'HTFC · 柜式离心风机' },
	{ value: 'HTF(A)', label: 'HTF(A) · 消防排烟风机' },
	{ value: 'SWF', label: 'SWF · 混流风机' },
];
const familyLabel = (value: string) => families.find((f) => f.value === value)?.label || value;
const valveFields = [
	{ key: 'mechanism', label: '基础机构成本（元）' },
	{ key: 'blade_thickness', label: '叶片厚度（mm）' },
	{ key: 'labor_base', label: '基础人工费（元）' },
];
const louverFields = ['面积成本（元/㎡）', '最低成本（元）', '宽 / 高增加（mm）', '附件倍率'];
const formulaFields = [
	{ key: 'material_expression' as const, label: '金属材料成本公式（元）' },
	{ key: 'other_expression' as const, label: '其他成本公式（元）' },
];
const valves = computed(() => Object.entries(props.catalog.valves).map(([key, value]) => ({ key, value, label: equipmentKinds[key] || key })));
const louvers = computed(() => Object.entries(props.catalog.louvers).map(([key, value]) => ({ key, value, label: louverLabels[key] || key })));
const matches = (values: unknown[], search: string) => values.join(' ').toLowerCase().includes(search.trim().toLowerCase());
const bodies = computed(() => props.catalog.fan_bodies.filter((b) => matches([b.family, b.size, b.source], bodySearch.value)));
const points = computed(() =>
	props.catalog.fan_points.filter(
		(p) =>
			(!familyFilter.value || p.family === familyFilter.value) &&
			(!onlyQuarantined.value || p.quarantined) &&
			matches([p.model, p.family, p.size, p.source], pointSearch.value)
	)
);
const pointPage = computed(() => points.value.slice((page.value - 1) * pageSize, page.value * pageSize));
watch([pointSearch, familyFilter, onlyQuarantined], () => (page.value = 1));
watch(
	() => points.value.length,
	() => (page.value = Math.max(1, Math.min(page.value, Math.ceil(points.value.length / pageSize))))
);

const editorVisible = ref(false),
	editorBaseline = ref(''),
	isNew = ref(false);
const pointEditor = ref<FanPoint>(),
	bodyEditor = ref<FanBody>(),
	powerText = ref(''),
	poleText = ref('');
const editorTitle = computed(() => `${props.editable ? (isNew.value ? '新增' : '编辑') : '查看'}${pointEditor.value ? '风机工况' : '风机本体参数'}`);
const editorSnapshot = () => JSON.stringify({ point: pointEditor.value, body: bodyEditor.value, powers: powerText.value, poles: poleText.value });
const editorDirty = computed(() => editorVisible.value && editorSnapshot() !== editorBaseline.value);
watch(editorDirty, (value) => emit('pending-change', value));
onBeforeUnmount(() => emit('pending-change', false));
function editPoint(point?: FanPoint) {
	if (!point && !props.editable) return;
	isNew.value = !point;
	bodyEditor.value = undefined;
	pointEditor.value = point
		? JSON.parse(JSON.stringify(point))
		: {
				id: 'manual:' + crypto.randomUUID(),
				model: '',
				family: '',
				size: '',
				speed: '',
				airflow: '',
				pressure: '',
				powers: [],
				poles: [],
				group: '',
				quarantined: false,
				source: '',
		  };
	powerText.value = pointEditor.value!.powers.join(' / ');
	poleText.value = pointEditor.value!.poles.join(' / ');
	editorBaseline.value = editorSnapshot();
	editorVisible.value = true;
}
function editBody(body?: FanBody) {
	if (!body && !props.editable) return;
	isNew.value = !body;
	pointEditor.value = undefined;
	bodyEditor.value = body
		? JSON.parse(JSON.stringify(body))
		: {
				id: 'manual:' + crypto.randomUUID(),
				family: '',
				size: '',
				steel_price: '',
				thickness: null,
				material_expression: '',
				other_expression: '',
				source: '',
		  };
	editorBaseline.value = editorSnapshot();
	editorVisible.value = true;
}
async function closeEditor(done: () => void) {
	try {
		if (editorDirty.value) await confirm('本次参数修改尚未应用到草稿，确认放弃？');
		done();
	} catch (e) {
		report(e);
	}
}
function applyEditor() {
	if (!props.editable) return;
	if (pointEditor.value) {
		const point = pointEditor.value;
		// Preserve untouched arrays (including their order and value types).
		if (powerText.value !== point.powers.join(' / ')) point.powers = powerText.value.split('/').map((v) => v.trim());
		if (poleText.value !== point.poles.join(' / ')) point.poles = poleText.value.split('/').map((v) => v.trim());
		if (isNew.value) props.catalog.fan_points.push(point);
		else
			props.catalog.fan_points.splice(
				props.catalog.fan_points.findIndex((p) => p.id === point.id),
				1,
				point
			);
	} else if (bodyEditor.value) {
		const body = bodyEditor.value;
		if (isNew.value) props.catalog.fan_bodies.push(body);
		else
			props.catalog.fan_bodies.splice(
				props.catalog.fan_bodies.findIndex((b) => b.id === body.id),
				1,
				body
			);
	}
	editorVisible.value = false;
}
async function removeEntry(kind: 'fan_points' | 'fan_bodies', id: string) {
	if (!props.editable) return;
	try {
		await confirm('从当前草稿移除此条参数？已发布的历史版本不受影响。');
		const index = props.catalog[kind].findIndex((entry) => entry.id === id);
		if (index >= 0) props.catalog[kind].splice(index, 1);
	} catch (e) {
		report(e);
	}
}
function tierRange(index: number, limit: string | null) {
	const previous = props.catalog.explosion_tiers[index - 1]?.limit || '待填写';
	if (limit === null) return index === 0 ? '全部成本' : `高于 ${previous} 元`;
	return (index === 0 ? '' : `高于 ${previous} 元，`) + `不超过 ${limit || '待填写'} 元`;
}
async function removeTier(index: number) {
	if (!props.editable) return;
	try {
		await confirm('从当前草稿移除此成本档位？');
		props.catalog.explosion_tiers.splice(index, 1);
	} catch (e) {
		report(e);
	}
}
</script>

<style scoped>
.parameter-intro,
.parameter-help {
	color: var(--el-text-color-secondary);
	line-height: 1.8;
	margin: 10px 0 18px;
}
.parameter-intro {
	color: var(--el-text-color-regular);
}
.parameter-toolbar {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 12px;
	margin: 16px 0;
}
.parameter-search {
	width: 270px;
}
.parameter-filter {
	width: 235px;
}
.parameter-pagination {
	display: flex;
	flex-wrap: wrap;
	justify-content: space-between;
	align-items: center;
	gap: 12px;
	margin-top: 18px;
}
.parameter-add {
	margin-top: 14px;
}
.parameter-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 0 20px;
}
.parameter-wide {
	grid-column: 1 / -1;
}
.parameter-formula {
	width: 100%;
	line-height: 1.8;
	overflow-wrap: anywhere;
	color: var(--el-text-color-secondary);
	margin: 8px 0 0;
}
.parameter-grid .el-select {
	width: 100%;
}
@media (max-width: 650px) {
	.parameter-grid {
		grid-template-columns: minmax(0, 1fr);
	}
	.parameter-search,
	.parameter-filter {
		width: 100%;
	}
}
</style>
