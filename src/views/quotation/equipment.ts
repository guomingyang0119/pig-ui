export const equipmentKinds: Record<string, string> = {
	fan: '风机',
	fire: '防火阀',
	electric_fire: '电动防火阀',
	electric_control: '电动调节阀',
	manual: '手动调节阀',
	check: '止回阀',
	pressure_relief: '余压阀',
	multi_leaf: '多叶排烟口 / 组合送风口',
	plate_smoke: '板式排烟口',
	louver: '百叶风口',
	silencer: '消声器',
	plenum: '静压箱 / 接管箱',
	elbow: '消声弯头',
	purchased: '外购设备',
};
export const equipmentCategories = ['风管', '风机', '风阀', '百叶风口', '消声设备', '外购设备', '其他材料'];
export const equipmentRates: Record<string, string> = {
	gross_margin: '毛利率',
	tax_factor: '含税系数',
	round_factor: '圆形设备系数',
	valve_steel: '阀体材料吨价（元/吨）',
	density: '材料密度换算',
	split_width: '拆分宽度界限（mm）',
	split_height: '拆分高度界限（mm）',
	splice_width: '拼接收费宽度界限（mm）',
	splice_height: '拼接收费高度界限（mm）',
	fire_splice: '防火 / 电动阀单边超限拼接费',
	manual_splice: '手动调节阀单边超限拼接费',
	check_splice: '止回阀拼接费（固定为 0）',
	remote_extra: '远控机构附加成本',
	near_control: '板式排烟口近控机构成本',
	remote_control: '板式排烟口远控基础机构成本',
	auto_control: '板式排烟口自动机构成本',
	panel_rate: '面板成本（元/㎡）',
	panel_edge: '面板尺寸增加（mm）',
	silencer_rate: '消声器成本（元/㎡）',
	plenum_rate: '静压箱成本（元/㎡）',
	double_layer_rate: '双层成本（元/㎡）',
	silencer_edge: '消声器每边增加（mm）',
	elbow_taxed_rate: '消声弯头固定含税价（元/㎡）',
	freight_threshold: '人工运费行金额门槛（元）',
	thickness_1_factor: '1mm 板厚除数',
	thickness_1_2_factor: '1.2mm 板厚除数',
	angle_factor: '角钢法兰除数',
};
export const equipmentComponents: Record<string, string> = {
	frame: '阀体框架',
	blade: '叶片',
	labor: '人工',
	link: '连杆',
	corners: '角码',
	shaft: '圆钢',
	consumables: '辅材',
	brace: '趴方',
	multi_frame: '多叶框架',
	multi_blade: '多叶叶片',
	multi_back: '背板',
	multi_brace: '多叶趴方',
	plate_frame: '板式框架',
	plate_blade: '板式叶片',
	plate_consumables: '板式辅材',
	plate_brace: '板式趴方',
	mechanism: '机构（含适用远控附加）',
	splice: '拼接',
	panel: '面板',
};
export const equipmentVariables: Record<string, string> = {
	width: '宽度（mm）',
	height: '高度（mm）',
	groups: '拆分组数',
	blades: '本行叶片数量',
	density: '密度换算值',
	frame_thickness: '阀体板厚（mm）',
	blade_thickness: '叶片板厚（mm）',
	frame_price: '阀体板材吨价',
	blade_price: '叶片板材吨价',
	back_price: '背板板材吨价',
	brace_count: '趴方数量',
	labor_base: '基础人工费',
	steel_price: '风机材料吨价',
	size: '机号',
	thickness: '板厚（mm）',
};
export function equipmentFormulaInChinese(expression: string) {
	return expression
		.replace(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[a-zA-Z_][a-zA-Z0-9_]*/g, (token) => equipmentVariables[token] || token)
		.replace(/\*/g, '×')
		.replace(/\//g, '÷');
}
export const louverLabels: Record<string, string> = {
	normally_open: '常开式百叶',
	single: '单层百叶',
	single_valve: '单层百叶带阀',
	single_mesh: '单层百叶带网',
	double: '双层百叶',
	double_valve: '双层百叶带阀',
	double_mesh: '双层百叶带网',
	rain: '防雨百叶',
	rain_mesh: '防雨百叶带网',
	gravity: '自垂百叶',
	gravity_valve: '自垂百叶带阀',
	access: '检修口',
	hinged: '门铰式风口',
	hinged_mesh: '门铰式风口带网',
	diffuser: '散流器',
	diffuser_valve: '散流器带阀',
	linear: '条缝 / 线形风口',
	linear_valve: '条缝 / 线形风口带阀',
	abs_single: 'ABS 单层百叶',
	abs_double: 'ABS 双层百叶',
	abs_hinged_mesh: 'ABS 门铰式风口带网',
};
export interface EquipmentField {
	key: string;
	label: string;
	choices?: string[][];
}

export const equipmentFields: EquipmentField[] = [
	{ key: 'equipment_kind', label: '计算类型', choices: Object.entries(equipmentKinds) },
	{ key: 'width', label: '宽度（mm）' },
	{ key: 'height', label: '高度（mm）' },
	{ key: 'length', label: '长度（mm）' },
	{ key: 'diameter', label: '圆形直径（mm）' },
	{ key: 'thickness', label: '板厚（mm）' },
	{ key: 'blade_thickness', label: '叶片厚度（mm）' },
	{ key: 'model', label: '需求型号' },
	{ key: 'size', label: '需求机号' },
	{ key: 'power', label: '需求功率（kW，双速用 /）' },
	{ key: 'airflow', label: '风量（m³/h）' },
	{ key: 'pressure', label: '风压（Pa）' },
	{ key: 'speed', label: '转速（r/min）' },
	{ key: 'airflow_low', label: '低速档风量（m³/h）' },
	{ key: 'pressure_low', label: '低速档风压（Pa）' },
	{
		key: 'dual_speed',
		label: '单双速',
		choices: [
			['false', '单速'],
			['true', '双速'],
		],
	},
	{
		key: 'material',
		label: '材料',
		choices: [
			['galvanized', '镀锌 / 普通'],
			['stainless_201', '201 不锈钢'],
			['stainless_304', '304 不锈钢'],
		],
	},
	{
		key: 'shape',
		label: '设备外形',
		choices: [
			['square', '方形'],
			['round', '圆形'],
		],
	},
	{ key: 'splice_cost', label: '双边超限确认拼接费（成本元）' },
	{
		key: 'control',
		label: '机构方式',
		choices: [
			['near', '近控'],
			['remote', '远控（基础机构 + 附加费）'],
			['auto', '自动'],
		],
	},
	{
		key: 'remote',
		label: '附加远控',
		choices: [
			['false', '不加'],
			['true', '加远控机构成本'],
		],
	},
	{
		key: 'explosion',
		label: '防爆',
		choices: [
			['false', '普通'],
			['true', '防爆'],
		],
	},
	{
		key: 'layer',
		label: '消声设备层数',
		choices: [
			['single', '单层'],
			['double', '双层'],
		],
	},
	{ key: 'flange', label: '消声设备法兰', choices: [['angle', '角钢法兰']] },
	{
		key: 'dimension_basis',
		label: '风口尺寸口径',
		choices: [
			['opening', '洞口'],
			['throat', '喉部'],
		],
	},
	{ key: 'area_per_unit', label: '每个消声弯头人工面积 / 方量' },
	{ key: 'mechanism_cost', label: '已核实基础机构成本（元）' },
	{ key: 'motor_model', label: '指定电机型号' },
	{ key: 'area_cost', label: '已核实综合面积成本（元/㎡）' },
	{ key: 'louver_type', label: '实际风口类型', choices: Object.entries(louverLabels) },
	{ key: 'pricing_louver_type', label: '风口计价口径', choices: Object.entries(louverLabels).filter(([code]) => code !== 'normally_open') },
	{ key: 'recognition_evidence', label: '备注识别依据' },
	{
		key: 'attached_valve_kind',
		label: '附阀类型',
		choices: [
			['fire', '防火阀'],
			['electric_fire', '电动防火阀'],
			['check', '止回阀'],
		],
	},
	{ key: 'attached_valve_width', label: '附阀宽度（mm）' },
	{ key: 'attached_valve_height', label: '附阀高度（mm）' },
	{ key: 'attached_valve_diameter', label: '附阀直径（mm，与宽高二选一）' },
	{ key: 'attached_valve_count', label: '每台风机附阀数量' },
	{
		key: 'attached_valve_cost_included',
		label: '风机成本是否已含阀',
		choices: [
			['false', '未含阀，分别计算'],
			['true', '已含阀，填整套成本'],
		],
	},
	{ key: 'fan_set_cost', label: '整套不含税成本（已含阀及适用防爆成本）' },
	{
		key: 'attached_valve_control',
		label: '附阀机构方式',
		choices: [
			['near', '近控'],
			['remote', '远控'],
			['auto', '自动'],
		],
	},
	{
		key: 'attached_valve_material',
		label: '附阀材质',
		choices: [
			['galvanized', '镀锌 / 普通'],
			['stainless_201', '201不锈钢'],
			['stainless_304', '304不锈钢'],
		],
	},
	{ key: 'attached_valve_thickness', label: '附阀板厚（mm）' },
	{ key: 'attached_valve_splice_cost', label: '附阀确认拼接费（元）' },
];

const equipmentFieldByKey = new Map(equipmentFields.map((field) => [field.key, field]));
const kindsByCategory: Record<string, string[]> = {
	风机: ['fan'],
	风阀: ['fire', 'electric_fire', 'electric_control', 'manual', 'check', 'pressure_relief', 'multi_leaf', 'plate_smoke'],
	百叶风口: ['louver'],
	消声设备: ['silencer', 'plenum', 'elbow'],
	外购设备: ['purchased'],
	其他材料: ['purchased'],
};
const fieldsByCategory: Record<string, string[]> = {
	风机: [
		'equipment_kind',
		'model',
		'size',
		'power',
		'airflow',
		'pressure',
		'speed',
		'airflow_low',
		'pressure_low',
		'dual_speed',
		'material',
		'thickness',
		'explosion',
		'motor_model',
		'attached_valve_kind',
		'attached_valve_width',
		'attached_valve_height',
		'attached_valve_diameter',
		'attached_valve_count',
		'attached_valve_cost_included',
		'fan_set_cost',
		'attached_valve_control',
		'attached_valve_material',
		'attached_valve_thickness',
		'attached_valve_splice_cost',
	],
	风阀: [
		'equipment_kind',
		'width',
		'height',
		'diameter',
		'thickness',
		'blade_thickness',
		'material',
		'shape',
		'control',
		'remote',
		'mechanism_cost',
		'splice_cost',
	],
	百叶风口: [
		'equipment_kind',
		'width',
		'height',
		'diameter',
		'material',
		'shape',
		'dimension_basis',
		'louver_type',
		'pricing_louver_type',
		'recognition_evidence',
		'area_cost',
	],
	消声设备: [
		'equipment_kind',
		'width',
		'height',
		'length',
		'diameter',
		'thickness',
		'material',
		'shape',
		'layer',
		'flange',
		'area_per_unit',
		'area_cost',
	],
	外购设备: ['equipment_kind', 'model'],
	其他材料: ['equipment_kind', 'model'],
};

/** Only expose inputs used by the selected product family. Hidden values remain in attributes. */
export function equipmentFieldsFor(category: string, kind = ''): EquipmentField[] {
	let keys = fieldsByCategory[category] || ['equipment_kind'];
	if (category === '消声设备' && kind === 'elbow') keys = ['equipment_kind', 'area_per_unit'];
	else if (category === '消声设备' && ['silencer', 'plenum'].includes(kind)) keys = keys.filter((key) => key !== 'area_per_unit');
	const allowedKinds = kindsByCategory[category];
	return keys.flatMap((key) => {
		const field = equipmentFieldByKey.get(key);
		if (!field) return [];
		if (key !== 'equipment_kind' || !allowedKinds) return [field];
		return [{ ...field, choices: allowedKinds.map((value) => [value, equipmentKinds[value]]) }];
	});
}
