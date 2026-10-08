/** 安装输入的默认结构与历史草稿兼容处理；补齐字段供表单编辑，安装费用仍由后端独立计算。 */
import type { InstallationEntry, QuoteBody } from '/@/types/quotation';
/** 创建尚待确认的安装项目。空单价和空数量不会默认成 0，避免缺失条件被误认为已经确认。 */
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
/** 打开报价时补齐安装整单选项、产品行安装条件及独立安装项目。仅缺少新字段时从旧开关推断初值，已有人工填写内容优先保留。 */
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
	/** 旧草稿没有现场费开关时，根据原现场费金额或原因补齐；交叉施工的计取决定也只在缺失时初始化。 */
	if (body.installation_options.include_site_fee == null)
		body.installation_options.include_site_fee = !!(body.installation_options.site_amount || body.installation_options.site_note);
	if (body.installation_options.cross_work_fee_decision == null)
		body.installation_options.cross_work_fee_decision =
			body.installation_options.cross_work && body.installation_options.include_site_fee ? 'charge' : '';
	body.installation_options.site_waive_reason ||= '';
	body.installation_items ||= [];
	/** 每个产品行与独立安装项都合并默认字段，使旧版本数据能直接进入同一安装编辑表单。 */
	body.rows.forEach((row) => (row.installation = { ...blankInstallation(), ...row.installation }));
	body.installation_items = body.installation_items.map((item) => ({ ...blankInstallation(), ...item }));
}
