/** Excel 导入页的分组与预览辅助逻辑。产品范围仅用于展示映射字段，实际识别与价格计算仍由后端完成。 */
import type { ImportSheet } from '/@/types/quotation';

/** 列映射以字段名关联原表的零基列索引；null 表示未选列，允许导入后补充缺少的参数。 */
export type ColumnMapping = Record<string, number | null>;
type Field = [string, string];
/** 映射表单的一组字段及提示信息；hiddenCount 用于显示尚未展开的补充独立列数量。 */
export interface MappingGroup {
	key: string;
	label: string;
	hint: string;
	fields: Field[];
	hiddenCount: number;
}
/** 从确认的起始行统计风管、设备、未知产品及上下文行，并取前五条产品形成预览。已识别的楼层、区域等说明行不参与产品计数。 */
export function analyseSheet(sheet: ImportSheet, start: number | undefined, mapping: ColumnMapping) {
	const contextMayDiffer = !!sheet.auto_context_rows?.length && !!sheet.auto_mapping &&
		Object.keys({ ...sheet.auto_mapping, ...mapping }).some(key => (sheet.auto_mapping?.[key] ?? null) !== (mapping[key] ?? null));
	const context = new Set((contextMayDiffer ? [] : sheet.auto_context_rows || []).map((r) => r.number));
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
		/** 这里的宽泛识别仅决定导入页参数分组，不能把“风管止回阀”等设备强制归入风管计价。 */
		// 此处的宽泛分组只控制导入界面，不决定产品的实际计价类别。
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
	return { ...counts, total: counts.duct + counts.equipment + counts.unknown, preview, contextMayDiffer };
}

/** 尺寸与材质可能由风管、设备共用；专属字段分别放入对应参数组，减少重复映射。 */
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

/** 根据当前工作表的产品范围生成通用、风管和设备映射组。共用数量列与尺寸列只显示一次，已匹配的独立参数自动展开，其他参数按需补充。 */
export function mappingGroups(
	profile: ReturnType<typeof analyseSheet>,
	mapping: ColumnMapping,
	expanded: string[],
	showAllTypes = false
): MappingGroup[] {
	const duct = profile.duct > 0 || showAllTypes;
	const equipment = profile.equipment > 0 || showAllTypes;
	const sharedDimensions = (duct && equipment) || (!duct && !equipment);
	/** 优先使用已映射的工程量列作为共用数量；只有原表确实有独立数量列时才提供第二个数量字段。 */
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
		['feature_description', '项目特征描述（仅备查）'],
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

/** 在规格、数量缺少可用来源列时提示人工核对；提示允许原表缺项在报价草稿补充，不直接判定产品为零价。 */
export function mappingWarnings(mapping: ColumnMapping) {
	const warnings: string[] = [];
	if (mapping.spec == null && !['model', 'width', 'diameter', 'thickness', 'power', 'airflow'].some((key) => mapping[key] != null))
		warnings.push('尚未匹配规格列，请核对；原表无规格时可在报价中补充。');
	if (mapping.quantity == null && mapping.engineering_quantity == null) warnings.push('尚未匹配数量或工程量列，请核对。');
	return warnings;
}
