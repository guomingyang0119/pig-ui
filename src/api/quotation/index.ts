/** 报价系统 HTTP 接口集中封装：复用 pig 登录与请求处理，统一使用 /admin/quotation 路径；版本变更请求携带 revision 供后端检查并发修改。 */
import request from '/@/utils/request';
import type {
	Catalog,
	CatalogBody,
	EquipmentCatalogBody,
	InstallationCatalogBody,
	ExportRecord,
	ImportResult,
	Quote,
	QuoteBody,
	QuoteResult,
	QuoteSettings,
	QuoteSummary,
	QuotePage,
	ReviewImportPreview,
	AiInputImportPreview,
	ProductRuleBody,
	ProductRuleRecommendations,
	QuoteRow,
	RowResult,
	EquipmentOptions,
	DuctOptions,
	InstallationOptions,
	AiImportJob,
} from '/@/types/quotation';

/** 后端统一响应外层，业务数据位于 data；成功与错误处理继续遵循公共 request 拦截器。 */
interface Result<T> {
	code: number;
	data: T;
	msg: string;
}
/** 新后端直接返回规范后的报价正文；可选字段兼容部署期间的旧版接口。 */
export interface QuoteMutationResult {
	revision: number;
	body?: QuoteBody;
	state?: Quote['state'];
	result?: QuoteResult | null;
	result_stale?: boolean;
}
const base = '/admin/quotation';
/** 发送普通 JSON 报价请求并提取业务 data；文件上传和下载需要单独设置 multipart 或 blob，因此在各方法中处理。 */
async function call<T>(path: string, method = 'get', data?: unknown): Promise<T> {
	const response = (await request({ url: base + path, method, data })) as unknown as Result<T>;
	return response.data;
}
export const quoteApi = {
	/** 查询可见产品规则版本，包含草稿、发布与停用状态，供行匹配和通用管理使用。 */
	productRules: () => call<Catalog<ProductRuleBody>[]>('/product-rules'),
	/** 对当前客户行读取模板、候选规则及推荐理由；只提供建议，不自动选择、发布或保存。 */
	productRuleRecommendations: (row: QuoteRow, body?: ProductRuleBody, quote?: QuoteBody) =>
		call<ProductRuleRecommendations>('/product-rules/recommendations', 'post', {
			row,
			body,
			installation_options: quote?.installation_options,
			duct_options: quote?.duct_options,
			equipment_options: quote?.equipment_options,
			context_rows: quote?.rows,
		}),
	/** 以本行参数和整单条件试算规则，返回未完成原因或逐步成本明细，不写入报价与共用规则。 */
	trialProductRule: (data: {
		body: ProductRuleBody;
		row: QuoteRow;
		equipment_options?: EquipmentOptions;
		duct_options?: DuctOptions;
		installation_options?: InstallationOptions;
		context_rows?: QuoteRow[];
		include_freight: boolean | null;
	}) => call<{ result: RowResult }>('/product-rules/trial', 'post', data),
	/** 建立通用产品规则草稿，后续校验和发布成功才参与其他报价的自动匹配。 */
	createProductRule: (body: ProductRuleBody) => call<{ id: string }>('/product-rules', 'post', { body }),
	/** 保存指定规则草稿，提交旧 revision 防止覆盖其他页面的修改。 */
	saveProductRule: (item: Catalog<ProductRuleBody>, body: ProductRuleBody) =>
		call<{ revision: number }>('/product-rules/' + item.id, 'put', { revision: item.revision, body }),
	/** 执行规则修订、校验、发布、停用或删除，动作与修订号交由后端校验。 */
	productRuleAction: (item: Catalog<ProductRuleBody>, action: 'revise' | 'trial' | 'publish' | 'retire' | 'delete') =>
		call<{ id?: string; revision?: number; message?: string }>('/product-rules/' + item.id + '/' + action, 'post', { revision: item.revision }),
	/** 查询风管、设备与安装等指标版本；泛型用于各面板读取对应正文结构。 */
	resources: <T = CatalogBody>() => call<Catalog<T>[]>('/resources'),
	/** 读取已核对安装源表的草稿正文，仅返回基准数据，不在此方法中创建或发布指标。 */
	installationSeed: () => call<InstallationCatalogBody>('/installation/catalog-seed'),
	/** 读取已核对设备源表的草稿正文，交由负责人核对后保存和发布。 */
	equipmentSeed: () => call<EquipmentCatalogBody>('/equipment/catalog-seed'),
	/** 初始化风管基价草稿并返回资源 ID，仍需负责人检查后发布。 */
	seed: () => call<{ id: string }>('/resources/seed', 'post', {}),
	/** 保存指标草稿正文与修订号，已发布指标的只读约束由后端验证。 */
	saveResource: (item: { id: string; revision: number; body: unknown }) =>
		call<{ revision: number }>('/resources/' + item.id, 'put', { body: item.body, revision: item.revision }),
	/** 按资源类型创建指标草稿，默认类型为风管，设备和安装显式传入各自类型。 */
	createResource: (body: CatalogBody | EquipmentCatalogBody | InstallationCatalogBody, kind = 'duct_catalog') =>
		call<{ id: string }>('/resources', 'post', { body, kind }),
	/** 执行指标生命周期动作，保留修订号检查以及后端返回的中文结果提示。 */
	resourceAction: (item: { id: string; revision: number }, action: string) =>
		call<{ id?: string; message?: string }>('/resources/' + item.id + '/' + action, 'post', { revision: item.revision }),
	/** 读取正式模板确认状态、权限、版本和引擎信息，供指标管理与导出核对。 */
	settings: () => call<QuoteSettings>('/settings'),
	/** 负责人更新正式模板确认开关，提交设置修订号防止并发覆盖。 */
	saveSettings: (settings: QuoteSettings, confirmed: boolean) =>
		call<QuoteSettings>('/settings', 'put', { revision: settings.revision, formal_template_confirmed: confirmed }),
	/** 查询当前或已归档报价摘要，服务端按登录人员权限限定可见范围。 */
	list: (archived = false) => call<QuoteSummary[]>('/quotes?archived=' + archived),
	/** 按页查询当前账号可见报价，客户和项目关键字在服务端筛选。 */
	listPage: (archived = false, page = 1, size = 20, keyword = '') =>
		call<QuotePage>(`/quotes/page?archived=${archived}&page=${page}&size=${size}&keyword=${encodeURIComponent(keyword)}`),
	/** 读取指定报价版本正文、上次试算、结果过期标志及历史导出记录。 */
	detail: (id: string) => call<Quote>('/quotes/' + id),
	/** 手工或按导入计划创建新报价草稿，返回编号供工作台打开。 */
	create: (data: Record<string, unknown> = {}) => call<{ id: string }>('/quotes', 'post', data),
	/** 保存报价正文与当前修订号，后端生成/保留行标识并使旧结果失效。 */
	save: (id: string, body: QuoteBody, revision: number) => call<QuoteMutationResult>('/quotes/' + id, 'put', { ...body, revision }),
	/** 基于已经保存的版本试算整单，返回计算结果和新修订号，待确认项目由引擎显式保留。 */
	calculate: (id: string, revision: number) => call<QuoteMutationResult>('/quotes/' + id + '/calculate', 'post', { revision }),
	/** 执行报价修订、归档、恢复或删除等状态动作，修订可能返回新报价编号。 */
	action: (id: string, revision: number, action: string) => call<{ id?: string }>('/quotes/' + id + '/' + action, 'post', { revision }),
	/** 重新识别已保存草稿中的产品行，返回风管、设备和待识别数量，不补入未导入的工作表。 */
	autoClassify: (id: string, revision: number) =>
		call<{ revision: number; counts: { duct: number; equipment: number; pending: number } }>('/quotes/' + id + '/auto-classify', 'post', {
			revision,
		}),
	/** 记录人工已核对客户原始资料与全部 AI 清单行的确认，针对当前 revision 生效。 */
	approveAi: (id: string, revision: number) =>
		call<{ revision: number }>(`/quotes/${id}/approve-ai`, 'post', { revision, review_confirmed: true }),
	/** 多文件 multipart 上传由后端 AI 整理并创建待核验草稿；延长请求超时至 10 分钟，文件请求关闭通用报文加密。 */
	async aiImport(files: File[]): Promise<{ id: string; row_count: number; product_row_count: number; special_row_count: number }> {
		const data = new FormData();
		files.forEach((file) => data.append('files', file));
		const response = (await request({ url: base + '/ai-imports', method: 'post', data, headers: { 'Enc-Flag': 'false' }, timeout: 600000 })) as unknown as Result<{
			id: string;
			row_count: number;
			product_row_count: number;
			special_row_count: number;
		}>;
		return response.data;
	},
	/** 每批调用沿用原AI入口和超时路由；请求ID支持上传响应丢失后的幂等重试。 */
	async startAiImport(files: File[], jobId: string): Promise<AiImportJob> {
		const data = new FormData();
		files.forEach((file) => data.append('files', file));
		const response = (await request({
			url: base + '/ai-imports',
			method: 'post',
			params: { action: 'start', jobId },
			data,
			headers: { 'Enc-Flag': 'false' },
			timeout: 180000,
		})) as unknown as Result<AiImportJob>;
		return response.data;
	},
	async nextAiImport(jobId: string): Promise<AiImportJob> {
		const response = (await request({
			url: base + '/ai-imports',
			method: 'post',
			params: { action: 'next', jobId },
			timeout: 180000,
		})) as unknown as Result<AiImportJob>;
		return response.data;
	},
	aiImportStatus: (jobId: string) => call<AiImportJob>('/ai-imports?jobId=' + encodeURIComponent(jobId)),
	aiImportJobs: () => call<AiImportJob[]>('/ai-imports'),
	cancelAiImport: (jobId: string) => call<AiImportJob>('/ai-imports?action=cancel&jobId=' + encodeURIComponent(jobId), 'post'),
	/** 下载绑定当前 AI 草稿版本的待核验 Excel；若 blob 实际为 JSON 错误，先解析业务提示，下载完成后回收对象 URL。 */
	async downloadStandardInput(id: string) {
		const blob = (await request({ url: `${base}/quotes/${id}/standard-input`, method: 'get', responseType: 'blob' })) as unknown as Blob;
		if (blob.type.includes('json')) {
			const error = JSON.parse(await blob.text());
			throw new Error(error.msg || '标准清单下载失败');
		}
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'AI待核验报价单.xlsx';
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	},
	/** 上传人工核验后的 AI 清单生成字段变化预览，绑定当前修订号；不重新调用模型或计算价格。 */
	async previewAiInputImport(id: string, revision: number, file: File): Promise<AiInputImportPreview> {
		const data = new FormData();
		data.append('revision', String(revision));
		data.append('file', file);
		const response = (await request({
			url: `${base}/quotes/${id}/ai-input-imports`,
			method: 'post',
			data,
			headers: { 'Enc-Flag': 'false' },
		})) as unknown as Result<AiInputImportPreview>;
		return response.data;
	},
	/** 人工确认预览后应用回导到原 AI 草稿，更新输入并恢复待核验状态，随后需要再次确认才能试算。 */
	applyAiInputImport: (id: string, revision: number, importId: string) =>
		call<{ revision: number }>(`/quotes/${id}/ai-input-imports/${importId}/apply`, 'post', { revision, review_confirmed: true }),
	/** 按客户资料索引下载原始附件，后端验证报价可见性；保留指定文件名并回收临时 URL。 */
	async downloadAiSource(id: string, index: number, filename: string) {
		const blob = (await request({ url: `${base}/quotes/${id}/ai-sources/${index}`, method: 'get', responseType: 'blob' })) as unknown as Blob;
		if (blob.type.includes('json')) {
			const error = JSON.parse(await blob.text());
			throw new Error(error.msg || '客户资料下载失败');
		}
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	},
	/** 按草稿/正式类型生成导出记录，正式导出由后端检查结果、待确认项、指标与模板，并锁定当前版本。 */
	export: (id: string, revision: number, kind: string) =>
		call<ExportRecord & { quote_state: Quote['state']; quote_revision: number }>('/quotes/' + id + '/export', 'post', { revision, kind }),
	/** 上传人工价格校对版，返回修改与派生金额预览，暂不改变报价。 */
	async previewReviewImport(id: string, revision: number, file: File): Promise<ReviewImportPreview> {
		const data = new FormData();
		data.append('revision', String(revision));
		data.append('file', file);
		const response = (await request({
			url: `${base}/quotes/${id}/review-imports`,
			method: 'post',
			data,
			headers: { 'Enc-Flag': 'false' },
		})) as unknown as Result<ReviewImportPreview>;
		return response.data;
	},
	/** 按导入预览编号和报价修订号应用人工价格，返回重新汇总结果与新修订号。 */
	applyReviewImport: (id: string, revision: number, importId: string, restoreScopeRowIds: string[] = []) =>
		call<{ result: QuoteResult; revision: number }>(`/quotes/${id}/review-imports/${importId}/apply`, 'post', {
			revision,
			restore_scope_row_ids: restoreScopeRowIds,
		}),
	/** 负责人查询报价与指标操作审计，用于追溯执行人员、目标及时间。 */
	audit: () => call<{ id: string; actor_name: string; action: string; target: string; created_at: string }[]>('/audit'),
	/** 上传常规 Excel 清单并读取所有工作表及建议映射；创建报价前仍须用户确认逐表导入计划。 */
	async upload(file: File): Promise<ImportResult> {
		const data = new FormData();
		data.append('file', file);
		const response = (await request({
			url: base + '/imports',
			method: 'post',
			data,
			headers: { 'Enc-Flag': 'false' },
		})) as unknown as Result<ImportResult>;
		return response.data;
	},
	/** 按已有导出文件编号下载历史文件；识别 JSON 错误响应，成功下载后释放浏览器临时对象 URL。 */
	async download(id: string, filename: string) {
		const blob = (await request({ url: base + '/exports/' + id, method: 'get', responseType: 'blob' })) as unknown as Blob;
		if (blob.type.includes('json')) {
			const error = JSON.parse(await blob.text());
			throw new Error(error.msg || '文件下载失败');
		}
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	},
};
