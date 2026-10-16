import { reactive } from 'vue';
import type { EquipmentMechanismDetail } from '/@/types/quotation';

/** 设备计价类型及中文字段字典，供设备指标维护、报价行参数和产品规则编辑共用；编码对应后端已有成本模型。 */
export const equipmentKinds: Record<string, string> = reactive({
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
});
/** 客户清单的产品类别用于选择参数组；具体成本算法还由 equipment_kind 与产品规则共同确定。 */
export const equipmentCategories = ['风管', '风机', '风阀', '百叶风口', '消声设备', '外购设备', '其他材料'];
/** 设备成本、毛利、税费、运费门槛等指标的中文说明，帮助负责人核对已发布指标的业务含义。 */
export const equipmentRates: Record<string, string> = {
	gross_margin: '毛利率',
	tax_factor: '含税系数',
	round_factor: '圆形风口 / 消声器 / 静压箱售价系数（不含圆阀）',
	valve_steel: '阀体材料吨价（元/吨）',
	fire_150_steel: '150°防火阀旧单价（材质未确认，仅历史参考，元/吨）',
	fire_150_201_steel: '150°防火阀201不锈钢专用吨价（元/吨）',
	fire_150_304_steel: '150°防火阀304不锈钢专用吨价（元/吨）',
	density: '材料密度换算',
	split_width: '拆分宽度界限（mm）',
	split_height: '拆分高度界限（mm）',
	pressure_supply_split_height: '正压送风口大尺寸整体高度界限（mm）',
	pressure_supply_mechanism_width: '正压送风口加机构宽度界限（mm）',
	pressure_supply_panel_rate: '正压送风口面板成本（元/㎡）',
	pressure_supply_mechanism: '正压送风口每套基础机构成本（元）',
	splice_width: '拼接宽度每段尺寸（mm）',
	splice_height: '拼接高度每段尺寸（mm）',
	fire_splice: '防火 / 电动阀每次拼接成本',
	manual_splice: '手动调节阀每次拼接成本',
	check_splice: '止回阀拼接费（固定为 0）',
	remote_extra: '其他阀类远控附加成本（元/台，不含防火阀、板式及正压送风口）',
	valve_remote_extra: '防火阀 / 板式 / 正压远控附加（元/机构）',
	fire_auto_extra: '防火阀全自动附加（元/机构）',
	near_control: '板式排烟口基础机构成本（元/机构）',
	remote_control: '旧板式远控基础成本（本次规则不使用）',
	auto_control: '旧板式自动机构成本（板式不再支持全自动）',
	panel_rate: '面板成本（元/㎡）',
	panel_edge: '面板尺寸增加（mm）',
	silencer_rate: '消声器成本（元/㎡）',
	plenum_rate: '静压箱成本（元/㎡）',
	double_layer_rate: '双层消声器 / 静压箱统一成本（元/㎡，不分地区）',
	silencer_edge: '消声器每边增加（mm）',
	elbow_taxed_rate: '消声弯头固定含税价（元/㎡）',
	freight_threshold: '人工运费行金额门槛（元）',
	thickness_1_factor: '1mm 板厚除数',
	thickness_1_2_factor: '1.2mm 板厚除数',
	angle_factor: '角钢法兰除数',
};
/** 设备内部成本分项的中文名称，仅用于核对计算明细，不作为客户导出的报价字段。 */
export const equipmentComponents: Record<string, string> = {
	frame: '阀体框架',
	blade: '叶片',
	labor: '人工',
	link: '连杆',
	pressure_supply_link: '正压送风口连杆',
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
	mechanism: '机构（基础成本 + 适用控制方式附加）',
	splice: '拼接',
	panel: '面板',
	round_processing: '圆阀加工费（完整成本的30%）',
};
/** 设备及风机本体公式变量的中文含义与单位；显示转换保持原英文表达式和实际计算规则不变。 */
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
/** 把公式中的已知变量和乘除符号转换为中文展示；数值（含科学计数法）及未知标识保留原文，便于与可编辑公式对照。 */
export function equipmentFormulaInChinese(expression: string) {
	return expression
		.replace(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[a-zA-Z_][a-zA-Z0-9_]*/g, (token) => equipmentVariables[token] || token)
		.replace(/\*/g, '×')
		.replace(/\//g, '÷');
}
/** 风口实际类型与计价口径的中文枚举。常开式百叶可保留客户产品类型，再单独确认采用的计价算法。 */
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
/** 设备参数表单的配置单元：字段编码对应行属性，choices 存在时使用中文下拉选项，否则允许手工输入。 */
export interface EquipmentField {
	key: string;
	label: string;
	choices?: string[][];
}

/** 可供设备报价录入的完整参数集合，含风机工况、阀体成本和附阀核验条件；实际页面按产品类别筛选显示。 */
export const equipmentFields: EquipmentField[] = reactive([
	{ key: 'equipment_kind', label: '计算类型', choices: Object.entries(equipmentKinds) },
	{ key: 'width', label: '宽度（mm）' },
	{ key: 'height', label: '高度（mm）' },
	{ key: 'length', label: '长度（mm）' },
	{ key: 'diameter', label: '圆形直径（mm）' },
	{ key: 'thickness', label: '板厚（mm）' },
	{ key: 'blade_thickness', label: '叶片厚度（mm）' },
	{
		key: 'valve_material_variant',
		label: '防火阀规格',
		choices: [
			['standard', '普通防火阀'],
			['fire_150', '150°防火阀（201默认 / 304明确指定）'],
		],
	},
	{ key: 'model', label: '需求型号' },
	{ key: 'position_tag', label: '客户原位号' },
	{ key: 'installation_description', label: '安装要求（不作为独立产品）' },
	{ key: 'source_total_area', label: '客户箱体总面积（㎡，仅核对）' },
	{
		key: 'purchased_type',
		label: '外购换气扇类型',
		choices: [['plastic', '塑料'], ['full_metal', '全金属'], ['semi_metal', '半金属'], ['metal', '金属（未细分）']],
	},
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
]);

/** 建立参数索引及类别映射，复用同一字段定义生成风机、风阀、风口、消声和外购产品的表单。 */
const equipmentFieldByKey = reactive(new Map(equipmentFields.map((field) => [field.key, field])));
const kindsByCategory: Record<string, string[]> = reactive({
	风机: ['fan'],
	风阀: ['fire', 'electric_fire', 'electric_control', 'manual', 'check', 'pressure_relief', 'multi_leaf', 'plate_smoke'],
	百叶风口: ['louver'],
	消声设备: ['silencer', 'plenum', 'elbow'],
	外购设备: ['purchased'],
	其他材料: ['purchased'],
});
const fieldsByCategory: Record<string, string[]> = reactive({
	风机: [
		'equipment_kind',
		'model',
		'position_tag',
		'installation_description',
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
	],
	风阀: [
		'equipment_kind',
		'width',
		'height',
		'diameter',
		'thickness',
		'blade_thickness',
		'valve_material_variant',
		'material',
		'shape',
		'control',
		'remote',
		'mechanism_cost',
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
		'source_total_area',
		'area_cost',
	],
	外购设备: ['equipment_kind', 'model', 'purchased_type'],
	其他材料: ['equipment_kind', 'model', 'purchased_type'],
});

/** 仅显示选定产品类别所需的参数；隐藏字段的已有值仍保留在 attributes 中。 */
/** 按产品类别和具体成本算法选择需要填写的参数，并限制可选计算类型。消声弯头使用人工面积，其他消声设备使用尺寸；隐藏字段仍留在 attributes 中。 */
export function equipmentFieldsFor(category: string, kind = '', productName = '', attributes: Record<string, string> = {}): EquipmentField[] {
	let keys = fieldsByCategory[category] || ['equipment_kind'];
	const fire150 =
		category === '风阀' &&
		(['fire', 'electric_fire'].includes(kind) || (!kind && (attributes.valve_material_variant === 'fire_150' || /防火(?:调节)?阀/.test(productName)))) &&
		(attributes.valve_material_variant === 'fire_150' || /(?<![0-9])150\s*(?:℃|°\s*C?|度|C\b)/i.test(productName));
	const controlChoices = equipmentControlChoices(kind, productName);
	if (controlChoices) keys = keys.filter((key) => key !== 'remote');
	if (category === '消声设备' && kind === 'elbow') keys = ['equipment_kind', 'area_per_unit'];
	else if (category === '消声设备' && ['silencer', 'plenum'].includes(kind)) keys = keys.filter((key) => key !== 'area_per_unit');
	if (kind !== 'plenum') keys = keys.filter((key) => key !== 'source_total_area');
	if (kind && !['fire', 'electric_fire'].includes(kind)) keys = keys.filter((key) => key !== 'valve_material_variant');
	const allowedKinds = kindsByCategory[category];
	return keys.flatMap((key) => {
		const field = equipmentFieldByKey.get(key);
		if (!field) return [];
		if (key === 'material' && fire150)
			return [
				{
					...field,
					label: '150°防火阀材质',
					choices: [
						['stainless_201', '201不锈钢（默认）'],
						['stainless_304', '304不锈钢（明确指定）'],
					],
				},
			];
		if (key === 'control' && controlChoices)
			return [{ ...field, label: kind === 'plate_smoke' ? '机构方式（板式不支持全自动）' : '机构方式', choices: controlChoices }];
		if (key !== 'equipment_kind' || !allowedKinds) return [field];
		return [{ ...field, choices: allowedKinds.map((value) => [value, equipmentKinds[value]]) }];
	});
}

/** 只约束本次确认的产品；正压同类名称与后端保持一致，不扩展普通多叶阀。 */
export function equipmentControlChoices(kind: string, productName = ''): string[][] | undefined {
	if (!kind) kind = /板式排烟/.test(productName) ? 'plate_smoke' : /防火(?:调节)?阀/.test(productName) ? 'fire' : 'multi_leaf';
	const fire = ['fire', 'electric_fire'].includes(kind);
	const plate = kind === 'plate_smoke';
	const pressure =
		kind === 'multi_leaf' &&
		!productName.includes('板式排烟') &&
		['正压送风口', '正压送风阀', '多叶排烟', '电动百叶风口', '多叶加压送风口', '加压送风口', '多叶送风口', '组合送风口'].some((name) =>
			productName.includes(name)
		);
	if (!fire && !plate && !pressure) return;
	const choices = [
		['near', plate ? '近控基础机构（默认）' : '基础机构（默认）'],
		['remote', '远控（附加费用按生效指标计算）'],
	];
	if (fire) choices.push(['auto', '全自动（附加费用按生效指标计算）']);
	return choices;
}

/** 人工改选机构时同步旧远控字段，单个机构选择不会叠加远控与全自动。 */
export function applyEquipmentParameter(attributes: Record<string, string>, key: string, value: string, kind = '', productName = '') {
	attributes[key] = value;
	if (key !== 'control' || !equipmentControlChoices(kind || attributes.equipment_kind, productName)) return;
	if (!value) delete attributes.remote;
	else attributes.remote = value === 'remote' ? 'true' : 'false';
}

/** 仅用于展示旧远控字段；明确的单选机构值始终优先，不回写来源数据。 */
export function equipmentParameterValue(attributes: Record<string, string>, key: string, kind = '', productName = ''): string {
	if (key === 'control' && !attributes.control && equipmentControlChoices(kind || attributes.equipment_kind, productName)) {
		if (attributes.remote === 'true') return 'remote';
		if (attributes.remote === 'false') return 'near';
	}
	return attributes[key] || '';
}

/** 保留后端保存的每件机构数和成本公式，旧结果无数据时不补算。 */
export function mechanismCostExplanation(detail?: EquipmentMechanismDetail): string {
	const count = detail?.mechanism_count == null ? '' : String(detail.mechanism_count).trim();
	const formula = detail?.component_formulas?.mechanism?.trim();
	return [count ? `每件机构数 N = ${count}` : '', formula ? `机构成本（每件）：${formula} 元` : ''].filter(Boolean).join('；');
}

/** 后端登记为权威来源；上面的字段仅兼容尚未升级的服务及离线表单。 */
export interface EquipmentParameterDefinitions {
 fields: EquipmentField[];
 fields_by_category: Record<string, string[]>;
 kinds_by_category: Record<string, string[]>;
 kinds: Record<string, string>;
}
export function configureEquipmentParameters(definitions: EquipmentParameterDefinitions) {
 if (!definitions?.fields?.length) return;
 equipmentFields.splice(0, equipmentFields.length, ...definitions.fields);
 equipmentFieldByKey.clear();
 for (const field of equipmentFields) equipmentFieldByKey.set(field.key, field);
 for (const key of Object.keys(fieldsByCategory)) delete fieldsByCategory[key];
 Object.assign(fieldsByCategory, definitions.fields_by_category);
 Object.assign(kindsByCategory, definitions.kinds_by_category);
 Object.assign(equipmentKinds, definitions.kinds);
}
