import type { InstallationEntry, QuoteBody } from '/@/types/quotation';
export const blankInstallation = (): InstallationEntry => ({
	name: '',
	category: '',
	project_id: '',
	unit_price: '',
	quantity: '',
	unit: '',
	product_state: '',
	power: '',
	auxiliary_type: '',
	auxiliary_price: '',
	note: '',
	excluded: false,
	exclude_reason: '',
});
export function prepareInstallation(body: QuoteBody) {
	body.installation_options ||= {
		included: !!(body.duct_options?.include_installation || body.equipment_options?.include_installation),
		region: '',
		include_auxiliaries: false,
		include_site_fee: false,
		height: '',
		cross_work: false,
		cross_work_fee_decision: '',
		site_amount: '',
		site_note: '',
		site_waive_reason: '',
	};
	if (body.installation_options.include_site_fee == null)
		body.installation_options.include_site_fee = !!(body.installation_options.site_amount || body.installation_options.site_note);
	if (body.installation_options.cross_work_fee_decision == null)
		body.installation_options.cross_work_fee_decision =
			body.installation_options.cross_work && body.installation_options.include_site_fee ? 'charge' : '';
	body.installation_options.site_waive_reason ||= '';
	body.installation_items ||= [];
	body.rows.forEach((row) => (row.installation = { ...blankInstallation(), ...row.installation }));
	body.installation_items = body.installation_items.map((item) => ({ ...blankInstallation(), ...item }));
}
