<template>
	<!-- 人工校对版回导的只读变化表：对照原值和新值，区分人工修改与系统重算的金额，并标明仍待补全的产品。 -->
	<div class="review-table-wrap">
		<el-table :data="rows" border :row-class-name="rowClass" empty-text="没有产品" table-layout="fixed">
			<el-table-column prop="sequence" label="序号" width="66" align="center" fixed="left" />
			<el-table-column prop="name" label="产品名称" width="220" fixed="left">
				<template #default="{ row }">
					<div :class="cellClass(row, 'name')">
						<div class="review-product">
							<strong>{{ display(row.name) }}</strong>
							<el-tag v-if="row.changed" type="success" effect="light" size="small">已修改</el-tag>
							<el-tag v-if="row.pending" type="warning" effect="light" size="small">待补全</el-tag>
						</div>
						<small v-if="manualChange(row, 'name')">原：{{ display(row.before_values.name) }}</small>
					</div>
				</template>
			</el-table-column>
			<el-table-column
				v-for="column in visibleColumns"
				:key="column.key"
				:prop="column.key"
				:label="column.label"
				:width="column.width"
				:align="column.align"
			>
				<template #default="{ row }">
					<div :class="cellClass(row, column.key)">
						<span>{{ display(row[column.key]) }}</span>
						<small v-if="manualChange(row, column.key)">原：{{ display(row.before_values[column.key]) }}</small>
						<small v-else-if="derivedChange(row, column.key)" class="review-derived">系统补算</small>
					</div>
				</template>
			</el-table-column>
		</el-table>
	</div>
</template>

<script setup lang="ts">
/** 人工校对版回导的只读变化表：对照原值和新值，区分人工修改与系统重算的金额，并标明仍待补全的产品。 */
import { computed } from 'vue';
import type { ReviewImportRow } from '/@/types/quotation';

const props = defineProps<{ rows: ReviewImportRow[]; installation: boolean }>();
/** 列结构与不含安装/含安装两套校对模板对应，安装费用与本行报价列仅在含安装模板下展示。 */
const columns = [
	{ key: 'thickness', label: '厚度（mm）', width: 105, align: 'center' },
	{ key: 'spec', label: '型号 / 规格', width: 230, align: 'left' },
	{ key: 'process', label: '法兰 / 工艺', width: 125, align: 'left' },
	{ key: 'unit', label: '单位', width: 70, align: 'center' },
	{ key: 'quantity', label: '数量', width: 95, align: 'right' },
	{ key: 'material_unit', label: '材料单价（元）', width: 125, align: 'right' },
	{ key: 'material_amount', label: '材料金额（元）', width: 135, align: 'right' },
	{ key: 'installation_amount', label: '安装费用（元）', width: 135, align: 'right', installation: true },
	{ key: 'line_total', label: '本行报价（元）', width: 135, align: 'right', installation: true },
	{ key: 'remark', label: '备注', width: 260, align: 'left' },
] as const;
const visibleColumns = computed(() => columns.filter((column) => !('installation' in column) || props.installation));

/** 判断指定字段是否由报价员在 Excel 中直接修改，用于突出人工录入的价格或条件。 */
function manualChange(row: ReviewImportRow, field: string) {
	return row.changes.some((change) => change.field === field && change.kind === 'manual');
}
/** 判断指定字段是否由回导器依据其他变化重新推算，便于区分手工输入与系统汇总。 */
function derivedChange(row: ReviewImportRow, field: string) {
	return row.changes.some((change) => change.field === field && change.kind === 'derived');
}
/** 为单元格组合人工修改、派生变化的显示样式，不改变回导预览数据。 */
function cellClass(row: ReviewImportRow, field: string) {
	return ['review-cell', { 'is-changed': manualChange(row, field), 'is-derived': derivedChange(row, field) }];
}
/** 空单元格以破折号展示，保留有效的 0 和原字符串，避免把空值与零价混淆。 */
function display(value?: string | number) {
	return value == null || String(value).trim() === '' ? '—' : String(value);
}
/** 按整行是否修改及是否仍待确认设置状态样式，一行可能同时具有两种状态。 */
function rowClass({ row }: { row: ReviewImportRow }) {
	return [row.changed ? 'review-row-modified' : '', row.pending ? 'review-row-pending' : ''].filter(Boolean).join(' ');
}
</script>

<style scoped lang="scss">
/* 用不同色块区分人工修改、派生变化和待确认行，原值以辅助文本展示，帮助回导前逐项复核。 */
.review-table-wrap {
	width: 100%;
	overflow: hidden;
	border-radius: 4px;
}
.review-product {
	display: flex;
	align-items: flex-start;
	flex-wrap: wrap;
	gap: 6px;
	strong {
		font-weight: 600;
	}
}
.review-cell {
	min-height: 42px;
	display: flex;
	flex-direction: column;
	justify-content: center;
	gap: 4px;
	line-height: 1.45;
	white-space: normal;
	overflow-wrap: anywhere;
	small {
		color: var(--el-text-color-secondary);
		font-size: 11px;
	}
	&.is-changed {
		margin: -8px -12px;
		padding: 8px 10px;
		border-left: 3px solid var(--el-color-success);
		background: var(--el-color-success-light-9);
		> span,
		strong {
			font-weight: 650;
			color: var(--el-color-success-dark-2);
		}
	}
	&.is-derived {
		margin: -8px -12px;
		padding: 8px 10px;
		border-left: 3px solid var(--el-color-primary-light-5);
		background: var(--el-color-primary-light-9);
	}
	.review-derived {
		color: var(--el-color-primary);
	}
}
:deep(.el-table__cell) {
	padding: 8px 0;
}
:deep(.review-row-modified > td.el-table__cell) {
	background: #fbfefc;
}
:deep(.review-row-pending > td.el-table__cell) {
	background: var(--el-color-warning-light-9);
}
</style>
