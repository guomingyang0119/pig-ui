import type { ImportSheet } from '/@/types/quotation';

export type ColumnMapping = Record<string, number | null>;
type Field = [string, string];
export interface MappingGroup {
	key: string;
	label: string;
	hint: string;
	fields: Field[];
	hiddenCount: number;
}
export function analyseSheet(sheet: ImportSheet, start: number | undefined, mapping: ColumnMapping) {
	const context = new Set((sheet.auto_context_rows || []).map((r) => r.number));
	const counts = { duct: 0, equipment: 0, unknown: 0, context: 0 };
	const rows = sheet.rows.filter((r) => start && r.number >= start);
	const preview = [];
	for (const row of rows) {
		if (context.has(row.number)) {
			counts.context++;
			continue;
		}
		const cell = (key: string) => (mapping[key] == null ? '' : row.cells[mapping[key]!] || '');
		const name = cell('name');
		const unit = cell('unit');
		// This broad grouping only controls the import UI, never the pricing category.
		const equipment = /风机|风阀|阀门|止回阀|蝶阀|调节阀|防火阀|排烟阀|风口|百叶|散流器|排气扇|换气扇|通风器|消声|消音|静压箱|空调/.test(name);
		const duct = !equipment && /风管/.test(name);
		const kind = duct ? 'duct' : equipment || /^(台|个|只|套|件|组|樘)$/.test(unit.trim()) ? 'equipment' : 'unknown';
		counts[kind]++;
		if (preview.length < 5)
			preview.push({
				number: row.number,
				name,
				spec: cell('spec') || cell('model'),
				quantity: cell('engineering_quantity') || cell('quantity'),
				unit,
				kind: kind === 'duct' ? '风管' : kind === 'equipment' ? '设备' : '待识别',
			});
	}
	return { ...counts, total: counts.duct + counts.equipment + counts.unknown, preview };
}

const dimensions: Field[] = [
	['material', '材质'],
	['thickness', '厚度（mm）'],
	['width', '宽度（mm）'],
	['height', '高度（mm）'],
	['diameter', '直径（mm）'],
];
const ductFields: Field[] = [
	['flange', '法兰方式'],
	['product_state', '成品状态'],
	['shape', '管件类型'],
	['round_flange_count', '圆法兰数量'],
	['flange_material', '角钢材质'],
	['flange_size', '角钢规格'],
	['flange_grade', '角钢档位'],
	['flange_meters', '本行角钢米数'],
];
const equipmentFields: Field[] = [
	['equipment_kind', '计算类型'],
	['louver_type', '实际风口类型'],
	['pricing_louver_type', '风口计价口径'],
	['recognition_evidence', '备注识别依据'],
	['attached_valve_kind', '附阀类型'],
	['attached_valve_width', '附阀宽度（mm）'],
	['attached_valve_height', '附阀高度（mm）'],
	['attached_valve_diameter', '附阀直径（mm）'],
	['attached_valve_count', '每台风机附阀数量'],
	['attached_valve_cost_included', '风机成本是否已含阀'],
	['fan_set_cost', '已核实整套不含税成本'],
	['attached_valve_control', '附阀机构方式'],
	['attached_valve_material', '附阀材质'],
	['attached_valve_thickness', '附阀板厚（mm）'],
	['attached_valve_splice_cost', '附阀确认拼接费'],
	['power', '功率（kW）'],
	['airflow', '风量（m³/h）'],
	['pressure', '风压（Pa）'],
	['speed', '转速（r/min）'],
	['length', '长度（mm）'],
];

export function mappingGroups(
	profile: ReturnType<typeof analyseSheet>,
	mapping: ColumnMapping,
	expanded: string[],
	showAllTypes = false
): MappingGroup[] {
	const duct = profile.duct > 0 || showAllTypes;
	const equipment = profile.equipment > 0 || showAllTypes;
	const sharedDimensions = (duct && equipment) || (!duct && !equipment);
	const quantityKey = mapping.engineering_quantity != null ? 'engineering_quantity' : 'quantity';
	const secondQuantity = quantityKey === 'quantity' ? 'engineering_quantity' : 'quantity';
	const base: Field[] = [
		['name', '产品名称'],
		['spec', '规格参数'],
		[quantityKey, '数量 / 工程量'],
		['unit', '单位'],
		['remark', '备注'],
	];
	const commonExtra: Field[] = [
		['model', '型号 / 尺寸（独立列）'],
		[secondQuantity, secondQuantity === 'quantity' ? '设备数量（另有一列时）' : '面积 / 工程量（另有一列时）'],
		['category', '品类'],
	];
	if (sharedDimensions) commonExtra.push(...dimensions);
	const group = (key: string, label: string, hint: string, required: Field[], optional: Field[]): MappingGroup => {
		const shown = optional.filter(([field]) => expanded.includes(key) || mapping[field] != null);
		return { key, label, hint, fields: [...required, ...shown], hiddenCount: optional.length - shown.length };
	};
	const result = [
		group(
			'common',
			sharedDimensions && duct && equipment ? '通用信息与共用规格' : '通用信息',
			'数量列只需选一次，系统按单位区分面积和设备数量。',
			base,
			commonExtra
		),
	];
	if (duct)
		result.push(
			group(
				'duct',
				'风管参数',
				'规格里已有的厚度、材质等无需重复选列；有独立列时再补充。',
				[],
				[...(sharedDimensions ? [] : dimensions), ...ductFields]
			)
		);
	if (equipment)
		result.push(
			group(
				'equipment',
				'设备参数',
				'规格里已有的尺寸、风量、风压和功率无需重复选列。',
				[],
				[...(sharedDimensions ? [] : dimensions), ...equipmentFields]
			)
		);
	return result;
}

export function mappingWarnings(mapping: ColumnMapping) {
	const warnings: string[] = [];
	if (mapping.spec == null && !['model', 'width', 'diameter', 'thickness', 'power', 'airflow'].some((key) => mapping[key] != null))
		warnings.push('尚未匹配规格列，请核对；原表无规格时可在报价中补充。');
	if (mapping.quantity == null && mapping.engineering_quantity == null) warnings.push('尚未匹配数量或工程量列，请核对。');
	return warnings;
}
