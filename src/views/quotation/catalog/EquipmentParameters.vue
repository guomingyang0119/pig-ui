<template>
	<!-- 设备成本与选型参数维护：编辑阀门、风口、风机本体、工况和防爆分档。表格应用到当前指标草稿后，还需父页面保存、校验与发布。 -->
	<div class="equipment-parameters" :class="{ 'single-parameter-section': product && !product.fan }">
		<p v-if="!product" class="parameter-intro">
			这里维护报价使用的基础参数。日常报价请在工作台填写客户需求；本页修改先保存为草稿，校验并发布后才用于新试算。
		</p>
		<el-tabs v-model="section">
			<el-tab-pane v-if="!product || product.valves" label="阀门参数" name="valves" lazy>
				<p class="parameter-help">
					基础参数按阀门类型共用，不按温度或材质另存。板式排烟口使用上方基础机构成本；正压送风口使用专用机构成本，均不支持全自动。
				</p>
				<el-table :data="valves" class="q-table" row-key="key">
					<el-table-column prop="label" label="阀门类型" min-width="220" />
					<el-table-column v-for="field in valveFields" :key="field.key" :label="field.label" min-width="180">
						<template #default="{ row }"
							><span v-if="field.key === 'mechanism' && row.key === 'plate_smoke'">使用板式排烟口基础机构指标</span
							><el-input v-else v-model="row.value[field.key]" :disabled="!editable" :aria-label="row.label + ' · ' + field.label"
						/></template>
					</el-table-column>
				</el-table>
			</el-tab-pane>
			<el-tab-pane v-if="!product || product.louvers" label="风口参数" name="louvers" lazy>
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
			<el-tab-pane v-if="!product || product.fan" label="风机本体" name="bodies" lazy>
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
			<el-tab-pane v-if="!product || product.fan" label="风机工况" name="points" lazy>
				<p class="parameter-help">按同系列风量、全压区间选择电机，区间包含上下限；转速仅供查阅。「隔离」的记录保留备查，不参与选型。</p>
				<div class="parameter-toolbar">
					<el-input v-model="pointSearch" clearable placeholder="搜索型号、机号或来源" aria-label="搜索风机工况" class="parameter-search" />
					<el-select v-model="familyFilter" clearable placeholder="全部风机系列" aria-label="筛选风机系列" class="parameter-filter">
						<el-option v-for="family in visibleFamilies" :key="family.value" :value="family.value" :label="family.label" />
					</el-select>
					<el-checkbox v-model="onlyQuarantined">只看隔离工况</el-checkbox>
					<el-button v-if="editable" type="primary" @click="editPoint()">新增工况</el-button>
				</div>
				<el-table :data="pointPage" class="q-table" row-key="id" empty-text="没有符合条件的工况，请调整搜索条件">
					<el-table-column prop="model" label="型号" min-width="150" />
					<el-table-column label="风量（m³/h）" min-width="170"><template #default="{ row }">{{ fanParameterRange(row, 'airflow') }}</template></el-table-column>
					<el-table-column label="全压（Pa）" min-width="140"><template #default="{ row }">{{ fanParameterRange(row, 'pressure') }}</template></el-table-column>
					<el-table-column prop="motor_model" label="电机型号" min-width="170" />
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
			<el-tab-pane v-if="!product || product.fan" label="防爆分档" name="explosion" lazy>
				<p class="parameter-help">各风机系列共用分档。以普通风机不含税成本判断档位，乘以下面的防爆倍率后再计算供货价。最后一档没有上限。</p>
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
					<template v-if="catalog.fan_selection === 'range-v1' || pointEditor.airflow_min !== undefined">
						<el-form-item v-for="field in rangeFields" :key="field.key" :label="field.label"><el-input v-model="pointEditor[field.key]" /></el-form-item>
						<el-form-item label="来源电机型号"><el-input v-model="pointEditor.motor_model" /></el-form-item>
					</template>
					<template v-else>
						<el-form-item label="风量（m³/h）"><el-input v-model="pointEditor.airflow" /></el-form-item>
						<el-form-item label="风压（Pa）"><el-input v-model="pointEditor.pressure" /></el-form-item>
					</template>
					<el-form-item label="功率（kW，双速用 / 分隔）"><el-input v-model="powerText" placeholder="例如 3 或 3 / 2.2" /></el-form-item>
					<el-form-item label="电机极数（多档用 / 分隔）"><el-input v-model="poleText" placeholder="例如 4 或 4 / 6" /></el-form-item>
					<el-form-item label="双速组号"><el-input v-model="pointEditor.group" placeholder="沿用来源分组；无分组时留空" /></el-form-item>
					<el-form-item label="选型状态"><el-checkbox v-model="pointEditor.quarantined">隔离此工况，不参与选型</el-checkbox></el-form-item>
					<template v-if="catalog.fan_selection !== 'range-v1' && pointEditor.airflow_min === undefined">
						<el-form-item label="低速档风量（m³/h，可留空）"><el-input v-model="pointEditor.airflow_low" /></el-form-item>
						<el-form-item label="低速档风压（Pa，可留空）"><el-input v-model="pointEditor.pressure_low" /></el-form-item>
					</template>
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
/** 设备成本与选型参数维护：编辑阀门、风口、风机本体、工况和防爆分档。表格应用到当前指标草稿后，还需父页面保存、校验与发布。 */
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import type { EquipmentCatalogBody, FanPoint, FanBody } from '/@/types/quotation';
import { equipmentKinds, louverLabels, equipmentFormulaInChinese as chineseFormula } from '/@/views/quotation/equipment';
import { confirm, report } from '/@/views/quotation/shared';
import { generateUUID } from '/@/utils/other';
import { fanProduct, louverKeys, type CatalogProduct } from './productDirectory';
import { fanParameterRange } from '../fanRange';

const rangeFields = [
	{ key: 'airflow_min', label: '风量下限（m³/h）' }, { key: 'airflow_max', label: '风量上限（m³/h）' },
	{ key: 'pressure_min', label: '全压下限（Pa）' }, { key: 'pressure_max', label: '全压上限（Pa）' },
	{ key: 'airflow_low_min', label: '双速低档风量下限（m³/h）' }, { key: 'airflow_low_max', label: '双速低档风量上限（m³/h）' },
	{ key: 'pressure_low_min', label: '双速低档全压下限（Pa）' }, { key: 'pressure_low_max', label: '双速低档全压上限（Pa）' },
];

/** 父页面提供指标草稿和只读标记；pending-change 通知父页面弹窗存在未应用输入，参与离开页面的提示。 */
const props = defineProps<{ catalog: EquipmentCatalogBody; editable: boolean; product?: CatalogProduct; initialSection?: string }>();
const emit = defineEmits<{ (e: 'pending-change', value: boolean): void }>();
/** 分别保存参数分组、风机本体检索、工况检索、系列/隔离筛选和分页状态，筛选不修改原始指标数据。 */
const section = ref('valves'),
	bodySearch = ref(''),
	pointSearch = ref(''),
	familyFilter = ref(''),
	onlyQuarantined = ref(false),
	page = ref(1);
const pageSize = 15;
watch(
	() => props.product?.id,
	() => {
		section.value = props.product?.fan ? (props.initialSection === 'points' ? 'points' : 'bodies') : props.product?.louvers ? 'louvers' : 'valves';
		familyFilter.value = '';
		bodySearch.value = '';
		pointSearch.value = '';
		page.value = 1;
	},
	{ immediate: true }
);
const families = [
	{ value: 'HTFC', label: 'HTFC · 柜式离心风机' },
	{ value: 'HTF(A)', label: 'HTF(A) · 消防排烟风机' },
	{ value: 'SWF', label: 'SWF · 混流风机' },
];
const familyLabel = (value: string) => families.find((f) => f.value === value)?.label || value;
const visibleFamilies = computed(() =>
	[...new Set([...families.map((f) => f.value), ...props.catalog.fan_points.map((p) => p.family)])]
		.filter((family) => !props.product || fanProduct(family) === props.product.id)
		.map((value) => ({ value, label: familyLabel(value) }))
);
/** 各中文字段的位置与后台阀门成本、风口数组参数和风机公式字段对应，编辑时保持原有数据结构。 */
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
/** 将阀门和风口字典转成中文表格行，风机本体与工况则在原列表基础上做搜索和分页。 */
const valves = computed(() =>
	Object.entries(props.catalog.valves)
		.filter(([key]) => !props.product || props.product.valves?.includes(key))
		.map(([key, value]) => ({ key, value, label: equipmentKinds[key] || key }))
);
const louvers = computed(() =>
	Object.entries(props.catalog.louvers)
		.filter(([key]) => !props.product || louverKeys(props.product.id, Object.keys(props.catalog.louvers)).includes(key))
		.map(([key, value]) => ({ key, value, label: louverLabels[key] || key }))
);
const matches = (values: unknown[], search: string) => values.join(' ').toLowerCase().includes(search.trim().toLowerCase());
const bodies = computed(() =>
	props.catalog.fan_bodies.filter(
		(b) => (!props.product || fanProduct(b.family) === props.product.id) && matches([b.family, b.size, b.source], bodySearch.value)
	)
);
const points = computed(() =>
	props.catalog.fan_points.filter(
		(p) =>
			(!props.product || fanProduct(p.family) === props.product.id) &&
			(!familyFilter.value || p.family === familyFilter.value) &&
			(!onlyQuarantined.value || p.quarantined) &&
			matches([p.model, p.family, p.size, p.source], pointSearch.value)
	)
);
/** 工况分页仅影响显示；筛选改变时重置页码，结果减少时将页码限制在有效范围。 */
const pointPage = computed(() => points.value.slice((page.value - 1) * pageSize, page.value * pageSize));
watch([pointSearch, familyFilter, onlyQuarantined], () => (page.value = 1));
watch(
	() => points.value.length,
	() => (page.value = Math.max(1, Math.min(page.value, Math.ceil(points.value.length / pageSize))))
);

/** 编辑器保存本体或工况的独立副本及基线，双速功率/极数用斜杠文本编辑，应用后才写入指标草稿。 */
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
/** 复制选中的风机工况供编辑或查看；新增记录生成手工来源 ID，并把多档功率与极数转成可核对文本。 */
function editPoint(point?: FanPoint) {
	if (!point && !props.editable) return;
	isNew.value = !point;
	bodyEditor.value = undefined;
	pointEditor.value = point
		? JSON.parse(JSON.stringify(point))
		: {
				id: 'manual:' + generateUUID(),
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
/** 复制风机本体成本参数，新增时保留空公式和空厚度，等待负责人填写而不猜测成本。 */
function editBody(body?: FanBody) {
	if (!body && !props.editable) return;
	isNew.value = !body;
	pointEditor.value = undefined;
	bodyEditor.value = body
		? JSON.parse(JSON.stringify(body))
		: {
				id: 'manual:' + generateUUID(),
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
/** 关闭参数弹窗前核对是否有未应用输入；只有确认放弃后才执行关闭回调。 */
async function closeEditor(done: () => void) {
	try {
		if (editorDirty.value) await confirm('本次参数修改尚未应用到草稿，确认放弃？');
		done();
	} catch (e) {
		report(e);
	}
}
/** 把弹窗确认的本体或工况替换/追加到当前草稿。未修改的功率、极数数组保持原顺序和类型，避免无关数据变化。 */
function applyEditor() {
	if (!props.editable) return;
	if (pointEditor.value) {
		const point = pointEditor.value;
		// 未修改的数组保持原样，包括原有顺序和每项值的类型。
		if (powerText.value !== point.powers.join(' / ')) point.powers = powerText.value.split('/').map((v) => v.trim());
		if (poleText.value !== point.poles.join(' / ')) point.poles = poleText.value.split('/').map((v) => v.trim());
		for (const key of ['airflow', 'pressure', 'airflow_low', 'pressure_low']) {
			if (point[`${key}_max`] !== undefined) point[key] = point[`${key}_max`];
		}
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
/** 仅从可编辑草稿移除指定本体或工况记录，操作前确认；已发布版本通过只读权限保留。 */
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
/** 按前后成本上限显示防爆倍率适用区间，null 上限表示最后一档无上限，当前上限包含本数。 */
function tierRange(index: number, limit: string | null) {
	const previous = props.catalog.explosion_tiers[index - 1]?.limit || '待填写';
	if (limit === null) return index === 0 ? '全部成本' : `高于 ${previous} 元`;
	return (index === 0 ? '' : `高于 ${previous} 元，`) + `不超过 ${limit || '待填写'} 元`;
}
/** 确认后删除当前草稿中的防爆成本档位，调整结果还需指标校验与发布才生效。 */
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
/* 设备参数标签页、分页工况表和中文编辑弹窗的布局，兼顾大量选型记录与成本公式的对照查看。 */
.parameter-intro,
.parameter-help {
	color: var(--el-text-color-secondary);
	line-height: 1.8;
	margin: 10px 0 18px;
}
.parameter-intro {
	color: var(--el-text-color-regular);
}
.single-parameter-section :deep(.el-tabs__header) {
	display: none;
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
