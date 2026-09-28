import { ElMessage, ElMessageBox } from 'element-plus';
import type { QuoteRow } from '/@/types/quotation';

export const stateLabels: Record<string, string> = { draft: '草稿', final: '已定稿', archived: '已归档', published: '已发布', retired: '已停用' };
export function money(value: string | number | null | undefined, digits = 1) {
	return value === null || value === undefined
		? '待确认'
		: Number(value).toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
export function report(error: unknown) {
	if (error === 'cancel' || error === 'close') return;
	const e = error as { msg?: string; message?: string };
	ElMessage.error(e?.msg || e?.message || '操作未完成，请检查服务是否启动后重试');
}
export async function confirm(message: string) {
	await ElMessageBox.confirm(message, '请确认', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' });
}
export function blankRow(): QuoteRow {
	return {
		name: '',
		spec: '',
		engineering_quantity: '',
		quantity: '',
		unit: '㎡',
		category: '风管',
		remark: '',
		attributes: {},
		excluded: false,
		exclude_reason: '',
		source_issue_confirmed: false,
	};
}
export const materials = [
	['galvanized', '镀锌板（按整单锌层）'],
	['galvanized_40', '40g 镀锌板'],
	['galvanized_80', '80g 镀锌板'],
	['stainless_201', '201 不锈钢'],
	['stainless_304', '304 不锈钢'],
];
export const flangeTypes = [
	['common', '共板法兰'],
	['angle', '角钢法兰'],
	['round', '圆法兰'],
];
export const shapes = [
	['semi_unspecified', '不区分直管/异形件'],
	['straight', '直管'],
	['irregular', '异形件'],
];
export const productStates = [
	['semi', '半成品'],
	['finished', '成品'],
];
export const rowFields = [
	{ key: 'material', label: '材质', choices: materials },
	{ key: 'thickness', label: '厚度（mm）' },
	{ key: 'model', label: '尺寸 / 型号', placeholder: '例如 800×320 或 Φ500' },
	{ key: 'width', label: '宽（mm）' },
	{ key: 'height', label: '高（mm）' },
	{ key: 'product_state', label: '本行成品状态', choices: productStates },
	{ key: 'shape', label: '本行管件类型', choices: shapes },
	{ key: 'flange', label: '本行法兰形式', choices: flangeTypes },
	{
		key: 'flange_material',
		label: '角钢材质',
		choices: [
			['black', '黑角铁'],
			['hot_galvanized', '热镀锌角铁'],
		],
	},
	{
		key: 'flange_size',
		label: '角钢规格',
		choices: [
			['30', '30#'],
			['40', '40#'],
			['50', '50#'],
		],
	},
	{ key: 'flange_grade', label: '角钢计算档位', placeholder: '30# 默认7.5；40# 默认12.5' },
	{ key: 'flange_meters', label: '本行角钢实际米数' },
	{ key: 'diameter', label: '圆风管直径（mm）' },
	{ key: 'round_flange_count', label: '圆法兰数量（个）', placeholder: '无数量时按面积折算' },
];
export const mappingFields = [
	['name', '产品名称（必选）'],
	['spec', '规格 / 厚度描述'],
	['model', '尺寸 / 型号'],
	['engineering_quantity', '工程量总面积'],
	['unit', '单位'],
	['remark', '备注'],
	['material', '材质'],
	['thickness', '厚度'],
	['flange', '法兰方式'],
	['product_state', '成品状态 / 报价备注'],
	['shape', '管件类型'],
	['diameter', '直径'],
	['round_flange_count', '圆法兰数量'],
	['width', '宽'],
	['height', '高'],
	['flange_material', '角钢材质'],
	['flange_size', '角钢规格'],
	['flange_grade', '角钢档位'],
	['flange_meters', '本行角钢米数'],
	['category', '品类'],
];
