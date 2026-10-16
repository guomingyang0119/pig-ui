<template>
	<!-- 常规 Excel 客户清单导入：先解析所有工作表，再核对起始行、字段映射和排除原因，最终按原工作表顺序合并创建自动识别报价草稿。 -->
	<el-dialog v-model="visible" title="导入客户清单" width="min(1040px, 94vw)" top="4vh" :close-on-click-modal="false" destroy-on-close>
		<div class="import-workspace" v-loading="busy">
			<div class="upload-area">
				<div>
					<strong>上传清单，自动匹配列</strong>
					<p>按项目名称和独立规格列识别，项目特征描述仅保留备查；试算失败后可选择AI辅助识别并重新试算。</p>
				</div>
				<input type="file" accept=".xlsx,.xls" :disabled="busy" aria-label="选择客户清单" @change="upload" />
			</div>
			<template v-if="imported">
				<div class="recognition-summary" aria-live="polite">
					<strong>{{ summaryLabel }}</strong>
					<span
						>{{ includedCount }} 个工作表参与报价<span v-if="contextCount">，{{ contextCount }} 行标题 / 说明单独保留</span></span
					>
				</div>
				<el-alert v-if="needsReview" type="warning" :closable="false" title="请先处理标记为待核对的工作表。" class="import-alert" />
				<el-collapse v-model="expanded" class="sheet-list">
					<el-collapse-item v-for="plan in plans" :key="plan.sheet.name" :name="plan.sheet.name">
						<template #title>
							<div class="sheet-heading">
								<strong>{{ plan.sheet.name }}</strong
								><span>{{ scopeLabel(profile(plan)) }}</span>
							</div>
							<el-tag :type="reviewIssue(plan) || warnings(plan).length ? 'warning' : 'info'" size="small">{{ sheetStatus(plan) }}</el-tag>
						</template>
						<template v-if="plan.sheet.rows.length">
							<el-alert
								v-if="plan.sheet.auxiliary"
								title="人工核对参数已自动关联主表，本工作表不单独计价。"
								type="info"
								:closable="false"
								class="import-alert"
							/>
							<el-alert v-if="reviewIssue(plan)" :title="reviewIssue(plan)" type="warning" :closable="false" class="import-alert" />
							<template v-if="!plan.excluded">
								<p v-for="warning in warnings(plan)" :key="warning" class="mapping-warning">{{ warning }}</p>
								<section v-for="group in groups(plan)" :key="group.key" class="mapping-section">
									<div class="section-heading">
										<h3>{{ group.label }}</h3>
										<el-button
											v-if="group.hiddenCount || plan.expandedGroups.includes(group.key)"
											link
											type="primary"
											@click="toggleGroup(plan, group.key)"
											>{{ plan.expandedGroups.includes(group.key) ? '收起可选字段' : '补充独立列' }}</el-button
										>
									</div>
									<p class="section-hint">{{ group.hint }}</p>
									<el-form v-if="group.fields.length" label-position="top" class="mapping-fields">
										<el-form-item v-for="[key, label] in group.fields" :key="key">
											<template #label
												><span>{{ label }}</span
												><span v-if="plan.mapping[key] != null" class="field-state">{{
													plan.mapping[key] === plan.sheet.auto_mapping?.[key] ? '已匹配' : '已调整'
												}}</span
												><span v-else-if="key === 'name'" class="required-label">必选</span></template
											>
											<el-select
												v-model="plan.mapping[key]"
												clearable
												filterable
												:aria-label="label"
												:placeholder="key === 'name' ? '请选择产品名称列' : '无独立列，可留空'"
												@clear="delete plan.mapping[key]"
											>
												<el-option
													v-for="column in columns(plan)"
													:key="column.index"
													:value="column.index"
													:label="column.label"
													:disabled="columnUsed(plan, key, column.index)"
												/>
											</el-select>
										</el-form-item>
									</el-form>
									<p v-else class="no-extra-columns">未发现独立参数列，无需逐项选择。</p>
								</section>
								<section class="mapping-section">
									<div class="section-heading">
										<h3>导入预览 <span>前 5 条产品</span></h3>
										<el-button link type="primary" @click="plan.showSource = !plan.showSource">{{
											plan.showSource ? '收起原表' : '查看原表'
										}}</el-button>
									</div>
									<el-table :data="profile(plan).preview" size="small" max-height="250" empty-text="请先核对产品名称列和起始行">
										<el-table-column prop="number" label="原行号" width="70" />
										<el-table-column prop="name" label="产品名称" min-width="190" show-overflow-tooltip />
										<el-table-column prop="spec" label="规格参数" min-width="220" show-overflow-tooltip
											><template #default="{ row }"
												><span :class="{ 'preview-missing': !row.spec }">{{ row.spec || '未读取规格' }}</span></template
											></el-table-column
										>
										<el-table-column prop="quantity" label="数量" width="80" />
										<el-table-column prop="unit" label="单位" width="65" />
										<el-table-column prop="kind" label="归类" width="80" />
									</el-table>
								</section>
							</template>
							<details v-if="!plan.sheet.auxiliary" class="import-settings" :open="!!reviewIssue(plan) || plan.excluded">
								<summary>起始行与其他设置</summary>
								<div class="settings-content">
									<label
										>产品数据起始行 <el-input-number v-model="plan.startRow" :min="1" :max="10000" size="small" aria-label="产品数据起始行"
									/></label>
									<el-checkbox v-model="plan.showAllTypes">显示其他产品类型的参数</el-checkbox>
									<el-checkbox v-model="plan.excluded">本表不参与报价（封面、说明等）</el-checkbox>
									<el-input v-if="plan.excluded" v-model="plan.excludeReason" placeholder="填写本表不参与报价的原因" maxlength="1000" />
								</div>
							</details>
							<el-table v-if="plan.showSource" :data="plan.sheet.rows.slice(0, 12)" border height="270" size="small" class="source-table">
								<el-table-column prop="number" label="原行号" width="70" fixed />
								<el-table-column v-for="column in columns(plan)" :key="column.index" :label="column.letter" min-width="130"
									><template #default="{ row }"
										><span :class="{ 'preview-missing': row.issues.includes(column.index) }">{{ row.cells[column.index] }}</span></template
									></el-table-column
								>
							</el-table>
						</template>
					</el-collapse-item>
				</el-collapse>
				<details class="import-settings order-metadata">
					<summary>客户与项目（选填）</summary>
					<el-form label-position="top" class="metadata-fields"
						><el-form-item label="客户名称"><el-input v-model="customer" /></el-form-item
						><el-form-item label="项目名称"><el-input v-model="project" /></el-form-item
					></el-form>
				</details>
				<p class="import-note">未识别的产品会保留待确认。原单价格不参与本次报价。</p>
			</template>
		</div>
		<template #footer>
			<div class="import-footer">
				<span>{{ imported ? '核对识别结果后即可创建整单报价' : '选择一份客户清单开始' }}</span>
				<div>
					<el-button :disabled="busy" @click="visible = false">取消</el-button
					><el-button type="primary" :disabled="!imported || !includedCount || needsReview" :loading="busy" @click="create"
						>确认导入并创建报价</el-button
					>
				</div>
			</div>
		</template>
	</el-dialog>
</template>
<script setup lang="ts">
/** 常规 Excel 客户清单导入：先解析所有工作表，再核对起始行、字段映射和排除原因，最终按原工作表顺序合并创建自动识别报价草稿。 */
import { computed, ref } from 'vue';
import { quoteApi } from '/@/api/quotation';
import { report } from '/@/views/quotation/shared';
import { analyseSheet, mappingGroups, mappingWarnings } from './importMapping';
import type { ColumnMapping } from './importMapping';
import type { ImportResult, ImportSheet } from '/@/types/quotation';
/** 每个工作表独立保存导入计划；空白表、人工排除表及自动关联的核对参数表有不同处理口径。 */
interface SheetPlan {
	sheet: ImportSheet;
	startRow?: number;
	mapping: ColumnMapping;
	excluded: boolean;
	excludeReason: string;
	expandedGroups: string[];
	showAllTypes: boolean;
	showSource: boolean;
}
const emit = defineEmits<{ (e: 'created', id: string): void }>();
/** 上传解析结果与可编辑 plans 分开保留，expanded 只控制需要展开核对的工作表，客户和项目用于新报价抬头。 */
const visible = ref(false),
	busy = ref(false),
	imported = ref<ImportResult>(),
	plans = ref<SheetPlan[]>([]),
	expanded = ref<string[]>([]),
	customer = ref(''),
	project = ref('');
/** 整单摘要仅汇总有数据且参与报价的工作表；needsReview 检查会阻止导入的缺项，规格/数量提示单独供用户核对。 */
const includedPlans = computed(() => plans.value.filter((p) => p.sheet.rows.length && !p.excluded));
const includedCount = computed(() => includedPlans.value.length);
const needsReview = computed(() => plans.value.some((p) => !!reviewIssue(p)));
const contextCount = computed(() => includedPlans.value.reduce((n, p) => n + profile(p).context, 0));
const summaryLabel = computed(() => {
	const total = includedPlans.value.reduce(
		(sum, plan) => {
			const p = profile(plan);
			sum.duct += p.duct;
			sum.equipment += p.equipment;
			sum.unknown += p.unknown;
			return sum;
		},
		{ duct: 0, equipment: 0, unknown: 0 }
	);
	return scopeLabel(total) || '等待识别清单内容';
});
/** 按本表当前起始行及映射实时计算产品范围和前五条预览，人工调整列后立即反映到摘要。 */
function profile(plan: SheetPlan) {
	return analyseSheet(plan.sheet, plan.startRow, plan.mapping);
}
/** 依据本表识别范围和展开状态生成映射参数组，混合表中的共用列不会重复出现。 */
function groups(plan: SheetPlan) {
	return mappingGroups(profile(plan), plan.mapping, plan.expandedGroups, plan.showAllTypes);
}
/** 已排除或空白表不再显示产品规格提示，其余工作表提示需要核对的规格与数量映射。 */
function warnings(plan: SheetPlan) {
	return plan.excluded || !plan.sheet.rows.length ? [] : mappingWarnings(plan.mapping);
}
/** 把本表或整单的风管、设备、待识别数量整理为可读摘要，保留未知项目的存在。 */
function scopeLabel(p: { duct: number; equipment: number; unknown: number }) {
	return [p.duct ? `风管 ${p.duct} 行` : '', p.equipment ? `设备 ${p.equipment} 行` : '', p.unknown ? `待识别 ${p.unknown} 行` : '']
		.filter(Boolean)
		.join(' · ');
}
/** 展开或收起一组补充独立列；不修改已有映射，收起后已经选定的字段仍会显示。 */
function toggleGroup(plan: SheetPlan, key: string) {
	plan.expandedGroups = plan.expandedGroups.includes(key) ? plan.expandedGroups.filter((v) => v !== key) : [...plan.expandedGroups, key];
}
/** 检查来源列是否被其他字段占用，帮助用户避免同一数量列同时映射到多个字段。 */
function columnUsed(plan: SheetPlan, key: string, index: number) {
	return Object.entries(plan.mapping).some(([field, value]) => field !== key && value === index);
}
/** 校验本表是否可以导入：非空产品表必须有起始行、名称列和后续数据，排除表必须说明原因，列映射不能重复。自动关联的辅助表不作为产品表校验。 */
function reviewIssue(plan: SheetPlan) {
	if (plan.sheet.auxiliary) return '';
	if (!plan.sheet.rows.length) return '';
	if (plan.excluded) return plan.excludeReason.trim() ? '' : '请填写本表不参与报价的原因。';
	if (!plan.startRow || plan.mapping.name == null) return '请核对产品数据起始行和产品名称列。';
	if (!plan.sheet.rows.some((r) => r.number >= plan.startRow!)) return '起始行后没有数据，请核对起始行。';
	const mapped = Object.values(plan.mapping).filter((v) => v != null);
	if (new Set(mapped).size !== mapped.length) return '同一列不能映射到不同字段，请核对重复映射。';
	return '';
}
/** 根据辅助表、空白表、排除决定和映射问题生成工作表状态，确保非空但未识别表头的清单不会被静默跳过。 */
function sheetStatus(plan: SheetPlan) {
	if (plan.sheet.auxiliary) return '核对参数 · 自动关联主表';
	if (!plan.sheet.rows.length) return '空白表 · 自动跳过';
	if (reviewIssue(plan)) return '待核对';
	if (plan.excluded) return '已排除';
	if (warnings(plan).length) return '请核对规格 / 数量';
	return `已匹配 ${Object.values(plan.mapping).filter((v) => v != null).length} 列`;
}
/** 按最大原始列数生成 Excel 列字母和表头说明；表头取自动识别或人工起始行的上一行。 */
function columns(plan: SheetPlan) {
	const count = Math.max(0, ...plan.sheet.rows.map((r) => r.cells.length));
	const headerRow = plan.sheet.rows.find((r) => r.number === (plan.sheet.auto_start_row || plan.startRow || 2) - 1);
	return Array.from({ length: count }, (_, index) => {
		let number = index + 1,
			letter = '';
		while (number > 0) {
			number--;
			letter = String.fromCharCode(65 + (number % 26)) + letter;
			number = Math.floor(number / 26);
		}
		return { index, letter, label: letter + ' · ' + (headerRow?.cells[index] || '空表头') };
	});
}
/** 重置本次导入计划与报价抬头，打开空白弹窗等待选择客户清单。 */
function open() {
	imported.value = undefined;
	plans.value = [];
	expanded.value = [];
	customer.value = '';
	project.value = '';
	visible.value = true;
}
/** 上传 Excel 获取整份文件解析结果，为每个表建立自动建议映射。核对参数表默认关联主表，其余缺项工作表自动展开提示。 */
async function upload(event: Event) {
	const file = (event.target as HTMLInputElement).files?.[0];
	if (!file) return;
	imported.value = undefined;
	plans.value = [];
	expanded.value = [];
	busy.value = true;
	try {
		imported.value = await quoteApi.upload(file);
		plans.value = imported.value.sheets.map((sheet) => ({
			sheet,
			startRow: sheet.auto_start_row || undefined,
			mapping: { ...sheet.auto_mapping },
			excluded: !!sheet.auxiliary,
			excludeReason: sheet.auxiliary ? '核对参数已自动关联主表，不单独计价' : '',
			expandedGroups: [],
			showAllTypes: false,
			showSource: false,
		}));
		expanded.value = plans.value.filter((plan) => !!reviewIssue(plan) || warnings(plan).length).map((plan) => plan.sheet.name);
		if (!expanded.value.length && includedPlans.value.length) expanded.value = [includedPlans.value[0].sheet.name];
	} catch (error) {
		report(error);
	} finally {
		busy.value = false;
	}
}
/** 把每个工作表的确认映射、起始行和排除原因一起提交；创建 auto_v1 草稿后将编号通知工作台继续补参数与试算。 */
async function create() {
	busy.value = true;
	try {
		const result = await quoteApi.create({
			pricing_mode: 'auto_v1',
			customer: customer.value,
			project: project.value,
			import_id: imported.value?.id,
			sheet_settings: plans.value.map((plan) => ({
				name: plan.sheet.name,
				start_row: plan.startRow,
				mapping: plan.mapping,
				excluded: plan.excluded,
				exclude_reason: plan.excludeReason,
			})),
		});
		visible.value = false;
		emit('created', result.id);
	} catch (error) {
		report(error);
	} finally {
		busy.value = false;
	}
}
defineExpose({ open });
</script>
<style scoped lang="scss">
/* 导入弹窗的工作表摘要、映射分组和来源预览样式；窄屏调整字段布局，便于人工逐表核对。 */
.import-workspace {
	max-height: 73vh;
	overflow-y: auto;
	padding: 0 8px 0 0;
	color: var(--el-text-color-primary);
}
.upload-area {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20px;
	padding: 4px 0 20px;
	border-bottom: 1px solid var(--el-border-color-lighter);
}
.upload-area strong {
	font-size: 16px;
}
.upload-area p,
.section-hint,
.import-note {
	margin: 6px 0 0;
	color: var(--el-text-color-secondary);
	font-size: 13px;
	line-height: 1.6;
}
.upload-area input {
	max-width: 360px;
	font-size: 13px;
}
.upload-area input::file-selector-button {
	padding: 9px 15px;
	margin-right: 12px;
	color: var(--el-color-primary);
	background: var(--el-color-primary-light-9);
	border: 1px solid var(--el-color-primary-light-7);
	border-radius: 5px;
	cursor: pointer;
	transition: background 0.15s;
}
.upload-area input::file-selector-button:hover {
	background: var(--el-color-primary-light-8);
}
.recognition-summary {
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	gap: 8px 20px;
	padding: 20px 0;
}
.recognition-summary strong {
	font-size: 17px;
}
.recognition-summary > span,
.sheet-heading > span {
	color: var(--el-text-color-secondary);
	font-size: 12px;
}
.sheet-heading {
	display: flex;
	flex: 1;
	gap: 14px;
	align-items: center;
	min-width: 0;
}
.sheet-heading strong {
	overflow-wrap: anywhere;
}
.sheet-list :deep(.el-collapse-item__header) {
	min-height: 54px;
	height: auto;
	gap: 12px;
	line-height: 1.5;
	padding: 10px 0;
}
.sheet-list :deep(.el-collapse-item__content) {
	padding-bottom: 18px;
}
.mapping-section {
	padding: 16px 0 8px;
	border-bottom: 1px solid var(--el-border-color-lighter);
}
.section-heading {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
}
.section-heading h3 {
	margin: 0;
	font-size: 14px;
	font-weight: 600;
}
.section-heading h3 span {
	margin-left: 8px;
	font-size: 12px;
	color: var(--el-text-color-secondary);
	font-weight: 400;
}
.section-hint {
	margin-bottom: 14px;
}
.mapping-fields {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 0 20px;
}
.mapping-fields :deep(.el-form-item) {
	margin-bottom: 16px;
}
.mapping-fields :deep(.el-form-item__label) {
	width: 100%;
	display: flex;
	justify-content: space-between;
	font-size: 13px;
}
.mapping-fields :deep(.el-select) {
	width: 100%;
}
.field-state {
	color: var(--el-color-primary);
	font-size: 11px;
}
.required-label,
.mapping-warning,
.preview-missing {
	color: var(--el-color-warning-dark-2);
}
.mapping-warning {
	font-size: 13px;
	margin: 8px 0;
}
.no-extra-columns {
	margin: 0 0 12px;
	font-size: 13px;
	color: var(--el-text-color-secondary);
}
.import-settings {
	margin-top: 16px;
}
.import-settings summary {
	cursor: pointer;
	color: var(--el-text-color-regular);
	font-size: 13px;
	padding: 5px 0;
}
.settings-content {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 8px;
	margin-top: 10px;
}
.settings-content label {
	display: flex;
	align-items: center;
	gap: 14px;
}
.metadata-fields {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 20px;
	margin-top: 12px;
}
.import-alert,
.source-table {
	margin-top: 14px;
}
.import-note {
	margin-top: 16px;
}
.import-footer {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 12px;
}
.import-footer > span {
	color: var(--el-text-color-secondary);
	font-size: 12px;
}
@media (max-width: 700px) {
	.upload-area {
		align-items: flex-start;
		flex-direction: column;
		gap: 12px;
	}
	.upload-area input {
		max-width: 100%;
	}
	.mapping-fields {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0 12px;
	}
	.sheet-heading {
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
	}
	.import-footer > span {
		display: none;
	}
	.import-footer {
		justify-content: flex-end;
	}
}
@media (max-width: 450px) {
	.mapping-fields,
	.metadata-fields {
		grid-template-columns: 1fr;
	}
}
</style>
