/** 报价前后端交换的数据契约；金额和数值条件以字符串保存，空金额表示尚未确认，避免前端浮点数参与正式计价。 */
export type Money = string | null;
/** AI整理检查点只返回进度；原资料及批次内容保存在服务端，不能由客户端改写。 */
export interface AiImportJob {
	job_id: string;
	state: 'ready' | 'processing' | 'failed' | 'completed' | 'cancelled';
	completed_batches: number;
	total_batches: number;
	current_label: string;
	error_message: string;
	lease_until?: number;
	id?: string;
	row_count?: number;
	product_row_count?: number;
	special_row_count?: number;
}
/** 全新产品算法的参数：input 使用本行值或通用默认值，catalog_rate 通过 rate_key 引用生效成本指标。 */
export interface ProductRuleParameter {
	key: string;
	label: string;
	unit: string;
	default_value?: string;
	source?: 'input' | 'catalog_rate';
	rate_key?: string;
}
/** 每个报价单位的一项未税成本，expression 由后端限定表达式引擎解析，不包含最终毛利、税费和付款计算。 */
export interface ProductRuleCost {
	name: string;
	expression: string;
}
/** 全新产品的参数表与成本项目集合，各成本项汇总后继续进入已有售价结算流程。 */
export interface ProductRuleCustomCost {
	parameters: ProductRuleParameter[];
	costs: ProductRuleCost[];
}
/** 组合产品的一项成本来源，可复用设备成本、指标费率或固定未税成本；用量算式与小数损耗率共同决定本项成本。 */
export interface ProductRuleComponent {
	name: string;
	source: 'equipment' | 'catalog_rate' | 'fixed';
	equipment_kind?: string;
	canonical_name?: string;
	attributes?: Record<string, string>;
	rate_key?: string;
	unit_cost?: string;
	unit?: string;
	quantity_expression: string;
	loss_rate: string;
}
/** 产品规则正文：alias 关联标准算法，combination 汇总组成项，formula 配置自定义成本；名称/别名及 conditions 控制匹配，生效日期控制可用范围。 */
export interface ProductRuleBody {
	name: string;
	rule_type: 'alias' | 'combination' | 'formula';
	category?: string;
	unit: string;
	aliases: string[];
	canonical_name?: string;
	attributes: Record<string, string>;
	conditions: Record<string, string>;
	components: ProductRuleComponent[];
	custom_cost?: ProductRuleCustomCost;
	description?: string;
	formula?: string;
	template_key?: string;
	/** 安装项目对应关系；指标项目动态取价，手填单价必须限定适用地区，不保存本单数量与施工条件。 */
	installation?: ProductRuleInstallation;
	/** 已有风机配置补价，沿用风机选型与结算；整台成本已包含适用防爆成本，附阀及安装单独计算。 */
	fan_price?: FanPriceSupplement;
	/** 未收录客户型号与已确认本体公式的对应关系；按当前材料、电机和有效指标重新计算。 */
	fan_cost?: FanCostTemplate;
	effective_from?: string;
	effective_to?: string;
}
/** 一个产品报价单位对应的安装用量，表达式只引用尺寸，不引用整行数量或生产损耗。 */
export interface ProductRuleInstallationItem {
	name?: string;
	project_id?: string;
	unit_price?: string;
	unit?: string;
	quantity_expression?: string;
	region?: string;
	note?: string;
}
export interface ProductRuleInstallation {
	mode: 'whole' | 'split';
	items: ProductRuleInstallationItem[];
}
/** 安装配置和真实计价上下文；推荐项目须人工确认，项目来源价保持动态读取。 */
export interface ProductRuleInstallationInput {
	included: boolean;
	region: string;
	status: 'not_applicable' | 'ready' | 'pending';
	source: 'row' | 'rule' | 'inherited' | 'none';
	mode: 'whole' | 'split';
	profile?: ProductRuleInstallation;
	projects: InstallationProject[];
	recommendations: { name: string; project_id: string; unit: string; reason: string }[];
	items: {
		entry: ProductRuleInstallationItem | InstallationEntry;
		effective?: InstallationLine;
		origins: Record<string, 'row' | 'rule' | 'inherited' | 'catalog'>;
		required_fields: string[];
		needs_confirmation: boolean;
		reason: string;
	}[];
	reason: string;
	catalog?: { id: string; version: number; source: string };
}
/** 单行规则推荐记录，保留来源、版本、评分和推荐理由，供人工判断而非直接应用。 */
export interface ProductRuleRecommendation {
	source: string;
	id?: string;
	family?: string;
	version?: number;
	body: ProductRuleBody;
	reasons: string[];
	score: number;
}
/** 推荐接口的模板、候选和发布权限，同时返回允许引用的成本指标列表。 */
export interface ProductRuleRecommendations {
	installation_input?: ProductRuleInstallationInput;
	templates: ProductRuleBody[];
	recommendations: ProductRuleRecommendation[];
	can_publish: boolean;
	catalog_rates?: { key: string; label: string }[];
	fan_input?: FanInputGuidance;
	parameter_input?: ProductInputGuidance;
}
/** 当前行或组成项实际采用的参数及来源，仅用于展示，不将继承值写入常用规则。 */
export interface EffectiveProductParameters {
	attributes: Record<string, string>;
	origins: Record<string, 'row' | 'recognized' | 'default' | 'inherited' | 'order' | 'engine'>;
	required_fields: string[];
}
export interface ProductInputGuidance extends EffectiveProductParameters {
	components: EffectiveProductParameters[];
}
/** 风机本单参数指导：解析/人工参数优先于规则默认值，必补项目由真实试算决定。 */
export interface FanInputGuidance {
	attributes: Record<string, string>;
	origins: Record<string, 'row' | 'recognized' | 'default'>;
	speed_mode: 'single' | 'dual' | 'unknown' | 'conflict';
	speed_reason: string;
	required_fields: string[];
	issue_kind: 'parameters' | 'selection' | 'cost' | 'conflict' | 'ready';
	reason: string;
	price_candidates?: FanPriceCandidate[];
	/** 系统已选工况及电机资料，仅供核对，不反填为客户需求。 */
	selected_parameters?: Record<string, string>;
	cost_template_mode?: boolean;
	cost_input?: {
		available: boolean;
		templates: { family: string; label: string; sizes: string[] }[];
		recommended_family: string;
		model: string;
		size: string;
		motors: FanCostMotor[];
	};
}
export interface FanCostMotor {
	model: string;
	powers: string[];
	poles: string[];
	cost: string;
}
export interface FanCostTemplate {
	family: string;
	model: string;
	size?: string;
	dual_speed?: boolean;
	/** 仅在已有电机缺价时保存的核实成本，严格限制到此电机及功率、极数配置。 */
	motor?: FanCostMotor;
}
export interface FanPriceSupplement {
	model: string;
	size: string;
	powers: string[];
	poles: string[];
	material: string;
	thickness: string;
	motor_model: string;
	explosion: boolean;
	unit_cost?: string;
	body_cost?: string;
	motor_cost?: string;
}
export interface FanPriceCandidate {
	id: string;
	price: FanPriceSupplement;
	missing_costs: ('body_cost' | 'motor_cost')[];
	reasons: string[];
}
/** 原始客户产品行及人工补充参数；风管工程量与设备数量分别保存，来源定位/原文用于核验，排除行必须记录原因。 */
export type QuoteScope = 'supply' | 'excluded' | 'installation_only';
export interface QuoteRow {
	/** 本单规则正文与 product_rule_family 共用引用二选一；客户原始名称不因别名转换而改写。 */
	product_rule?: ProductRuleBody;
	product_rule_family?: string;
	installation?: InstallationEntry;
	candidate_id?: string;
	row_id?: string;
	name: string;
	spec: string;
	/** 风管使用工程量总面积，设备使用 quantity 数量；这里不把面积再次乘设备数量。 */
	engineering_quantity: string;
	quantity: string;
	unit: string;
	category: string;
	remark: string;
	attributes: Record<string, string>;
	/** 服务端根据试运行开关和阈值生成的AI识别核对提示；评分是模型自评，不代表准确率。 */
	ai_confidence_reason?: string;
	ai_confidence_score?: string | number;
	ai_confidence_threshold?: number;
	/** 服务端汇总的系统纠正及其依据，只用于审计展示，不表示尚需人工核对。 */
	ai_correction_reason?: string;
	excluded: boolean;
	exclude_reason: string;
	/** 仅报价安装，默认 false；与 excluded 互斥，整单必须包含安装。 */
	installation_only?: boolean;
	/** 原表数据异常必须人工确认，original 与 source_row/source_sheet 用于回到原客户资料核对。 */
	source_issue_confirmed: boolean;
	source_issue?: boolean;
	source_issue_reason?: string;
	source_row?: string | number;
	source_sheet?: string;
	original?: { cells: string[]; source_file?: string; source_sheet?: string; source_sheet_index?: number; source_row?: number; source_locator?: string; source_excerpt?: string };
}
/** 风管整单默认条件与配件输入；各行可覆盖具体参数，工程量口径、含税、安装、运费及付款选项参与后端计算。 */
export interface DuctOptions {
	area_basis: string;
	product_state: string;
	shape: string;
	zinc_layer: string;
	flange: string;
	tax_included: boolean | null;
	include_common_punch: boolean | null;
	corner_count: string;
	clip_meters: string;
	flange_30_meters: string;
	flange_40_meters: string;
	include_installation: boolean;
	installation_amount: string;
	include_freight: boolean;
	payment_option: string;
}
/** 报价可编辑正文，包含客户抬头、产品行、整单条件与来源记录；include_freight 是统一运费选择，AI 草稿额外维护人工核验状态。 */
export interface QuoteBody {
	ai_review_status?: 'pending' | 'approved';
	ai_source_files?: string[];
	ai_reused_from?: { quote_id: string; row_count: number };
	/** 整单运费口径：true/false 为明确包含/不包含，null 保留旧草稿条件冲突或尚未选择的待确认状态。 */
	include_freight: boolean | null;
	recognition_mode?: string;
	installation_options?: InstallationOptions;
	installation_items?: InstallationEntry[];
	equipment_options?: EquipmentOptions;
	customer: string;
	project: string;
	contact: string;
	delivery_location: string;
	quote_date: string;
	note: string;
	pricing_mode: string;
	duct_options: DuctOptions;
	rows: QuoteRow[];
	source_filename?: string;
	source_sheet?: string;
	source_sheets?: { name: string; status: 'imported' | 'empty' | 'excluded'; row_count: number; exclude_reason?: string }[];
	source_special_rows?: { source_sheet?: string; source_row: number; kind: string; quantity?: string; original?: { cells: string[] } }[];
}
/** 已保存的每件产品机构成本依据；仅展示，不根据当前行参数重新计算。 */
export interface EquipmentMechanismDetail {
	mechanism_count?: number | string;
	component_formulas?: Record<string, string>;
}
/** 后端逐行计价结果，pending/priced/excluded/installation_only 分别表示待确认/已报价/不报价/仅安装；材料与安装状态独立。 */
export interface RowResult {
	installation_input?: ProductRuleInstallationInput;
	installation_detail?: InstallationLine & { children?: InstallationLine[] };
	fan_input?: FanInputGuidance;
	parameter_input?: ProductInputGuidance;
	product_rule?: { id?: string; family?: string; version?: number; body?: ProductRuleBody; scope?: string };
	product_rule_issue?: string;
	pricing_mode?: string;
	candidates?: { id: string; body: { name: string; attributes: FanPoint } }[];
	detail?: EquipmentMechanismDetail & {
		selected_fan?: FanPoint;
		selection_note?: string;
		components?:
			| Record<string, string>
			| { name: string; source: string; quantity: string; effective_quantity?: string; unit_cost: string; amount: string; detail?: EquipmentMechanismDetail }[];
		parameters?: { key: string; label: string; unit: string; value: Money; source: string }[];
		formula_costs?: { name: string; expression: string; amount: string }[];
		[key: string]: unknown;
	};
	/** 尚未确认的单价与金额保持 null，不能作为零价参与最终正式报价。 */
	status: 'pending' | 'priced' | 'excluded' | 'installation_only';
	reason: string;
	unit_price: Money;
	amount: Money;
	billing_quantity?: Money;
	billing_unit?: string;
	body_amount?: Money;
	flange_amount?: Money;
	round_flange_amount?: Money;
	installation_status?: 'pending' | 'priced' | 'excluded';
	installation_reason?: string;
	installation_amount?: Money;
	line_total?: Money;
	trace: { step: string; expression: string; value: string }[];
}
/** 整单试算快照，记录逐行价格、各类费用、付款/取整、待确认数量及所用引擎和指标版本；formal_ready 标明当前是否满足正式报价条件。 */
export interface QuoteResult {
	manual_review_import?: {
		import_id: string;
		filename: string;
		imported_at: string;
		actor: string;
		change_count: number;
	};
	installation_engine_version?: string;
	before_payment_total?: Money;
	equipment_material_total?: Money;
	equipment_freight_total?: Money;
	payment_amount?: Money;
	rounding_difference?: Money;
	rows: RowResult[];
	subtotal: Money;
	total: Money;
	pending_count: number;
	/** 材料、安装及整单计价条件通过后为 true；正式导出仍单独核对模板许可和当前指标，前端不自行重算此标志。 */
	formal_ready: boolean;
	issues: string[];
	fees: Record<string, InstallationFee>;
	duct_catalog?: { id: string; version: number };
	payment?: { label: string; coefficient: string };
	calculated_at?: string;
	engine_version: string;
	installation_notes: string[];
}

/** 人工价格校对版的单字段差异；manual 为用户直接修改，derived 为后端依据修改重新计算。 */
export interface ReviewImportChange {
	line: number;
	product: string;
	field: string;
	label: string;
	before: string;
	after: string;
	kind: 'manual' | 'derived';
}

/** 回导预览的完整可见产品行，保留原字段值、变更列表、派生字段和待确认状态，便于与 Excel 逐行对照。 */
export interface ReviewImportRow {
	scope?: 'quoted' | 'excluded' | 'installation_only';
	scope_restore_required?: boolean;
	candidate_values?: Record<string, string>;
	visible_row: number;
	sequence: number;
	name: string;
	thickness: string;
	spec: string;
	process: string;
	unit: string;
	quantity: string;
	material_unit: string;
	material_amount: string;
	installation_amount: string;
	line_total: string;
	remark: string;
	changed: boolean;
	pending: boolean;
	before_values: Record<string, string>;
	changes: ReviewImportChange[];
	derived_fields: string[];
}

/** 人工价格回导的预览汇总，column_count 区分不含安装 10 列与含安装 12 列，导入编号用于确认应用。 */
export interface ReviewImportPreview {
	/** 填价触发的恢复供货范围候选，必须由用户逐项明确确认。 */
	scope_restorations?: { source_row_id: string; name: string; previous_scope: 'excluded' | 'installation_only'; visible_row?: number }[];
	import_id: string;
	filename: string;
	line_count: number;
	change_count: number;
	derived_count: number;
	changed_row_count: number;
	unchanged_count: number;
	column_count: 10 | 12;
	review_rows: ReviewImportRow[];
	changes: ReviewImportChange[];
	changes_truncated: boolean;
	pending_count: number;
	subtotal: string;
	material_total: string;
	equipment_freight_total: string;
	installation_total: string;
	before_payment_total: string;
}

/** AI 清单人工核验回导的单字段变化，row_id 绑定原产品行，visible_row 用于指出 Excel 对应位置。 */
export interface AiInputImportChange {
	row_id: string;
	visible_row: number;
	name: string;
	field: string;
	field_label: string;
	before: string;
	after: string;
}

/** AI 清单字段回导的只读预览，统计产品/特殊行和变化数量；确认应用后更新原草稿，不直接产生价格。 */
export interface AiInputImportPreview {
	import_id: string;
	filename: string;
	line_count: number;
	product_row_count: number;
	special_row_count: number;
	change_count: number;
	changed_row_count: number;
	unchanged_count: number;
	changes: AiInputImportChange[];
	review_rows: { row_id: string; visible_row: number; name: string; changed: boolean; changes: AiInputImportChange[] }[];
}
/** 一次已经生成的导出文件记录，文件编号与类型用于历史下载，不依赖重新试算当前价格。 */
export interface ExportRecord {
	id: string;
	filename: string;
	kind: string;
	created_at: string;
}
/** 完整报价版本：family/version 标识修订系列，revision 用于并发校验，body/result 分开保存，result_stale 提示旧结果不能继续正式导出。 */
export interface Quote {
	id: string;
	family: string;
	version: number;
	/** 同一业务版本每次修改递增 revision，用于避免两个页面同时保存造成覆盖；version 则代表报价修订版本。 */
	revision: number;
	state: 'draft' | 'final' | 'archived';
	body: QuoteBody;
	result: QuoteResult | null;
	result_stale: boolean;
	exports: ExportRecord[];
}
/** 报价列表使用的轻量摘要，保留客户、项目、版本、总额、待确认数和导出数量，无需加载所有行明细。 */
export interface QuoteSummary {
	recognition_mode?: string;
	pricing_mode?: string;
	id: string;
	customer: string;
	project: string;
	quote_date: string;
	state: string;
	version: number;
	revision: number;
	row_count: number;
	total: Money;
	pending_count: number;
	export_count: number;
	updated_at: string;
}
/** 报价记录分页结果；页码由服务端校正，总数只统计当前账号及筛选范围。 */
export interface QuotePage {
	records: QuoteSummary[];
	total: number;
	page: number;
	size: number;
}
/** 付款方案编码、安装口径和系数；整单安装状态决定可选方案，系数由后端在对应阶段应用。 */
export interface PaymentTerm {
	code: string;
	mode: string;
	label: string;
	coefficient: string;
}
/** 风管指标正文，维护板材、角钢基价、加工费率、局部公式和付款系数，并保留来源和生效日期。 */
export interface CatalogBody {
	name: string;
	source: string;
	effective_from: string;
	effective_to: string;
	company_id: string;
	materials: { name: string; material: string; thickness: string; ton_price: string; source_cell?: string; unit: string }[];
	flanges: { name: string; material: string; size: number; grade: string; ton_price: string; processing_per_m: string; unit: string }[];
	rates: Record<string, string>;
	expressions: Record<string, string>;
	payment_terms: PaymentTerm[];
}
/** 各类指标及产品规则共用的版本外层；kind 决定正文类型，family/version 用于生命周期，revision 检查并发更新。 */
export interface Catalog<T = CatalogBody> {
	id: string;
	family: string;
	version: number;
	revision: number;
	kind: string;
	status: string;
	body: T;
}
/** Excel 工作表解析结果：来源行号/单元格保留原表，建议与自动映射供用户核对；上下文行和辅助表不另计产品。 */
export interface ImportSheet {
	auxiliary?: boolean;
	auto_context_rows?: { number: number; kind: string; label: string }[];
	auto_mapping?: Record<string, number | null>;
	auto_start_row?: number | null;
	equipment_mapping?: Record<string, number | null>;
	equipment_start_row?: number | null;
	name: string;
	rows: { number: number; cells: string[]; issues: number[] }[];
	suggested_mapping: Record<string, number | null>;
	suggested_start_row: number | null;
}
/** 设备整单含税、付款及送货条件；include_freight 与整单开关同步，region 和人工运费输入在含运费时供引擎使用。 */
export interface EquipmentOptions {
	include_installation?: boolean;
	tax_included: boolean | null;
	payment_option: string;
	include_freight: boolean | null;
	region: string;
	freight_amount: string;
}
/** 产品行或独立安装项的人工条件，支持指定指标项目或确认未税单价，数量/单位、功率及辅材另行核对。 */
export interface InstallationEntry {
	name: string;
	category: string;
	project_id: string;
	unit_price: string;
	quantity: string;
	unit: string;
	product_state: string;
	power: string;
	auxiliary_type: string;
	auxiliary_price: string;
	note: string;
	excluded: boolean;
	exclude_reason: string;
}
/** 安装整单条件：省区、辅材、施工工况和现场费；交叉施工必须记录计取决定，金额或免收原因供正式备注与校验使用。 */
export interface InstallationOptions {
	included: boolean;
	region: string;
	include_auxiliaries: boolean;
	include_site_fee: boolean;
	height: string;
	cross_work: boolean;
	cross_work_fee_decision: '' | 'charge' | 'waive';
	site_amount: string;
	site_note: string;
	site_waive_reason: string;
}
/** 安装指标中的原表项目，按地区与 kind 适用，price 为未税销售单价；部分陕西风机使用 power_prices 功率分档。 */
export interface InstallationProject {
	id: string;
	name: string;
	regions: string[];
	kind: string;
	unit: string;
	price: string | null;
	power_prices?: string[];
	auxiliary_type: string;
	source: string;
	note: string;
}
/** 安装指标版本正文，保留源表哈希、项目和辅材/税费参数，未税安装销售价不再重复加材料毛利。 */
export interface InstallationCatalogBody {
	name: string;
	company_id: string;
	source: string;
	source_sha256: string;
	effective_from: string;
	effective_to: string;
	tax_factor: string;
	four_auxiliary_price: string;
	projects: InstallationProject[];
}
/** 逐项安装结果，包含人工/辅材、税费、取整及待确认原因，与产品行和独立安装项目顺序对应。 */
export interface InstallationLine {
	project_id?: string | null;
	power?: Money;
	product_state?: string;
	name: string;
	status: string;
	reason: string;
	unit_price?: Money;
	quantity?: Money;
	unit?: string;
	amount?: Money;
	untaxed_total?: Money;
	tax_amount?: Money;
	rounding_difference?: Money;
	quoted_amount?: Money;
	note?: string;
	project_name?: string;
	auxiliary?: { unit_price: string; amount: string };
}
/** 整单安装费用汇总与各行明细，现场附加费单列并记录原因；金额是否已经计入产品行由 included_in_rows 标明。 */
export interface InstallationFee {
	amount: Money;
	status: string;
	reason: string;
	included_in_rows?: boolean;
	untaxed_amount?: Money;
	labor_amount?: Money;
	auxiliary_amount?: Money;
	line_amount?: Money;
	site_amount?: Money;
	site_quoted_amount?: Money;
	site_tax_amount?: Money;
	site_rounding_difference?: Money;
	site_note?: string;
	tax_factor?: Money;
	tax_amount?: Money;
	rounding_difference?: Money;
	lines?: InstallationLine[];
}
/** 用于风机选型的原始工况记录，包含系列/型号、单双速功率、风量风压及隔离质量标记，来源保留以便核对。 */
export interface FanPoint {
	id: string;
	model: string;
	family: string;
	size: string;
	group?: string;
	source?: string;
	/** 隔离的源工况记录仍保留用于追溯，是否允许参与选型由后端质量与规则检查决定。 */
	quarantined?: boolean;
	quality_note?: string;
	requirement_mismatches?: string;
	airflow_low?: string;
	pressure_low?: string;
	powers: string[];
	poles: string[];
	airflow: string;
	pressure: string;
	speed: string;
	[key: string]: unknown;
}
/** 风机本体成本参数，按系列和机号关联材料吨价、板厚及本体公式，来源可追溯。 */
export interface FanBody {
	id: string;
	family: string;
	size: string;
	steel_price: string;
	thickness: string | null;
	material_expression: string;
	other_expression: string;
	source: string;
	[key: string]: unknown;
}
/** 阀门基础机构、叶片厚度和人工成本参数；额外键保留后台已有成本模型的数据。 */
export interface ValveParameters {
	mechanism: string;
	blade_thickness: string;
	labor_base: string;
	[key: string]: unknown;
}
/** 设备指标中板材、电机或外购产品的成本条目，不同来源按需提供型号、材质、功率或单价。 */
export interface EquipmentPrice {
	id: string;
	name?: string;
	model?: string;
	product_type?: string;
	legacy_ids?: string[];
	price_basis?: 'cost' | 'sale';
	sale_price?: string;
	source_batch?: string;
	source_taxed_price?: string;
	source_tax_divisor?: string;
	specification?: string;
	airflow?: string;
	pressure?: string;
	power?: string;
	voltage?: string;
	frequency?: string;
	duct_diameter?: string;
	material?: string;
	thickness?: string;
	ton_price?: string;
	powers?: string[];
	poles?: string[];
	cost?: string;
	unit?: string;
	source?: string;
}
/** 设备生效指标正文，包含成本费率、运费地区、付款条件、材料电机价格、风机工况及各类产品参数与源文件哈希。 */
export interface EquipmentCatalogBody {
	name: string;
	source: string;
	/** 标识后端提供的百叶调价批次，避免旧后端价格被误认为最新价。 */
	louver_price_batch?: string;
	effective_from: string;
	effective_to: string;
	company_id: string;
	rates: Record<string, string>;
	regions: Record<string, string>;
	payment_terms: PaymentTerm[];
	materials: EquipmentPrice[];
	motors: EquipmentPrice[];
	purchased: EquipmentPrice[];
	fan_points: FanPoint[];
	fan_bodies: FanBody[];
	valves: Record<string, ValveParameters>;
	louvers: Record<string, string[]>;
	explosion_tiers: { limit: string | null; factor: string }[];
	valve_expressions: Record<string, string>;
	source_files: { name: string; sha256: string }[];
}
/** 一次普通 Excel 上传的解析记录，保留导入编号、文件名与所有工作表，后续创建草稿提交逐表导入计划。 */
export interface ImportResult {
	id: string;
	filename: string;
	sheets: ImportSheet[];
}
/** 报价配置快照，展示管理权限、引擎/模板版本与哈希；policy 控制负责人是否确认正式模板。 */
export interface QuoteSettings {
	can_manage: boolean;
	engine_version: string;
	template_version: string;
	template_sha256: string;
	revision: number;
	policy: { formal_template_confirmed: boolean };
}
