export type Money = string | null;
export interface QuoteRow {
	installation?: InstallationEntry;
	candidate_id?: string;
	row_id?: string;
	name: string;
	spec: string;
	engineering_quantity: string;
	quantity: string;
	unit: string;
	category: string;
	remark: string;
	attributes: Record<string, string>;
	excluded: boolean;
	exclude_reason: string;
	source_issue_confirmed: boolean;
	source_issue?: boolean;
	source_row?: string | number;
	source_sheet?: string;
	original?: { cells: string[] };
}
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
export interface QuoteBody {
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
export interface RowResult {
	pricing_mode?: string;
	candidates?: { id: string; body: { name: string; attributes: FanPoint } }[];
	detail?: { selected_fan?: FanPoint; selection_note?: string; components?: Record<string, string>; [key: string]: unknown };
	status: 'pending' | 'priced' | 'excluded';
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
	formal_ready: boolean;
	issues: string[];
	fees: Record<string, InstallationFee>;
	duct_catalog?: { id: string; version: number };
	payment?: { label: string; coefficient: string };
	calculated_at?: string;
	engine_version: string;
	installation_notes: string[];
}

export interface ReviewImportChange {
	line: number;
	product: string;
	field: string;
	label: string;
	before: string;
	after: string;
	kind: 'manual' | 'derived';
}

export interface ReviewImportRow {
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

export interface ReviewImportPreview {
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
export interface ExportRecord {
	id: string;
	filename: string;
	kind: string;
	created_at: string;
}
export interface Quote {
	id: string;
	family: string;
	version: number;
	revision: number;
	state: 'draft' | 'final' | 'archived';
	body: QuoteBody;
	result: QuoteResult | null;
	result_stale: boolean;
	exports: ExportRecord[];
}
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
export interface PaymentTerm {
	code: string;
	mode: string;
	label: string;
	coefficient: string;
}
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
export interface Catalog<T = CatalogBody> {
	id: string;
	family: string;
	version: number;
	revision: number;
	kind: string;
	status: string;
	body: T;
}
export interface ImportSheet {
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
export interface EquipmentOptions {
	include_installation?: boolean;
	tax_included: boolean | null;
	payment_option: string;
	include_freight: boolean | null;
	region: string;
	freight_amount: string;
}
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
export interface InstallationOptions {
	included: boolean;
	region: string;
	include_auxiliaries: boolean;
	include_site_fee: boolean;
	height: string;
	cross_work: boolean;
	site_amount: string;
	site_note: string;
}
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
export interface InstallationLine {
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
export interface FanPoint {
	id: string;
	model: string;
	family: string;
	size: string;
	group?: string;
	source?: string;
	quarantined?: boolean;
	quality_note?: string;
	airflow_low?: string;
	pressure_low?: string;
	powers: string[];
	poles: string[];
	airflow: string;
	pressure: string;
	speed: string;
	[key: string]: unknown;
}
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
export interface ValveParameters {
	mechanism: string;
	blade_thickness: string;
	labor_base: string;
	[key: string]: unknown;
}
export interface EquipmentPrice {
	id: string;
	name?: string;
	model?: string;
	material?: string;
	thickness?: string;
	ton_price?: string;
	powers?: string[];
	poles?: string[];
	cost?: string;
	unit?: string;
	source?: string;
}
export interface EquipmentCatalogBody {
	name: string;
	source: string;
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
export interface ImportResult {
	id: string;
	filename: string;
	sheets: ImportSheet[];
}
export interface QuoteSettings {
	can_manage: boolean;
	engine_version: string;
	template_version: string;
	template_sha256: string;
	revision: number;
	policy: { formal_template_confirmed: boolean };
}
