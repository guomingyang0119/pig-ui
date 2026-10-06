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
	ReviewImportPreview,
	AiInputImportPreview,
	ProductRuleBody,
	ProductRuleRecommendations,
	QuoteRow,
	RowResult,
	EquipmentOptions,
	DuctOptions,
	InstallationOptions,
} from '/@/types/quotation';

interface Result<T> {
	code: number;
	data: T;
	msg: string;
}
const base = '/admin/quotation';
async function call<T>(path: string, method = 'get', data?: unknown): Promise<T> {
	const response = (await request({ url: base + path, method, data })) as unknown as Result<T>;
	return response.data;
}
export const quoteApi = {
	productRules: () => call<Catalog<ProductRuleBody>[]>('/product-rules'),
	productRuleRecommendations: (row: QuoteRow) => call<ProductRuleRecommendations>('/product-rules/recommendations', 'post', { row }),
	trialProductRule: (data: {
		body: ProductRuleBody;
		row: QuoteRow;
		equipment_options?: EquipmentOptions;
		duct_options?: DuctOptions;
		installation_options?: InstallationOptions;
		include_freight: boolean | null;
	}) => call<{ result: RowResult }>('/product-rules/trial', 'post', data),
	createProductRule: (body: ProductRuleBody) => call<{ id: string }>('/product-rules', 'post', { body }),
	saveProductRule: (item: Catalog<ProductRuleBody>, body: ProductRuleBody) =>
		call<{ revision: number }>('/product-rules/' + item.id, 'put', { revision: item.revision, body }),
	productRuleAction: (item: Catalog<ProductRuleBody>, action: 'revise' | 'trial' | 'publish' | 'retire' | 'delete') =>
		call<{ id?: string; revision?: number; message?: string }>('/product-rules/' + item.id + '/' + action, 'post', { revision: item.revision }),
	resources: <T = CatalogBody>() => call<Catalog<T>[]>('/resources'),
	installationSeed: () => call<InstallationCatalogBody>('/installation/catalog-seed'),
	equipmentSeed: () => call<EquipmentCatalogBody>('/equipment/catalog-seed'),
	seed: () => call<{ id: string }>('/resources/seed', 'post', {}),
	saveResource: (item: { id: string; revision: number; body: unknown }) =>
		call<{ revision: number }>('/resources/' + item.id, 'put', { body: item.body, revision: item.revision }),
	createResource: (body: CatalogBody | EquipmentCatalogBody | InstallationCatalogBody, kind = 'duct_catalog') =>
		call<{ id: string }>('/resources', 'post', { body, kind }),
	resourceAction: (item: { id: string; revision: number }, action: string) =>
		call<{ id?: string; message?: string }>('/resources/' + item.id + '/' + action, 'post', { revision: item.revision }),
	settings: () => call<QuoteSettings>('/settings'),
	saveSettings: (settings: QuoteSettings, confirmed: boolean) =>
		call<QuoteSettings>('/settings', 'put', { revision: settings.revision, formal_template_confirmed: confirmed }),
	list: (archived = false) => call<QuoteSummary[]>('/quotes?archived=' + archived),
	detail: (id: string) => call<Quote>('/quotes/' + id),
	create: (data: Record<string, unknown> = {}) => call<{ id: string }>('/quotes', 'post', data),
	save: (id: string, body: QuoteBody, revision: number) => call<{ revision: number }>('/quotes/' + id, 'put', { ...body, revision }),
	calculate: (id: string, revision: number) => call<{ result: QuoteResult; revision: number }>('/quotes/' + id + '/calculate', 'post', { revision }),
	action: (id: string, revision: number, action: string) => call<{ id?: string }>('/quotes/' + id + '/' + action, 'post', { revision }),
	autoClassify: (id: string, revision: number) =>
		call<{ revision: number; counts: { duct: number; equipment: number; pending: number } }>('/quotes/' + id + '/auto-classify', 'post', {
			revision,
		}),
	approveAi: (id: string, revision: number) =>
		call<{ revision: number }>(`/quotes/${id}/approve-ai`, 'post', { revision, review_confirmed: true }),
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
	applyAiInputImport: (id: string, revision: number, importId: string) =>
		call<{ revision: number }>(`/quotes/${id}/ai-input-imports/${importId}/apply`, 'post', { revision, review_confirmed: true }),
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
	export: (id: string, revision: number, kind: string) => call<ExportRecord>('/quotes/' + id + '/export', 'post', { revision, kind }),
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
	applyReviewImport: (id: string, revision: number, importId: string) =>
		call<{ result: QuoteResult; revision: number }>(`/quotes/${id}/review-imports/${importId}/apply`, 'post', { revision }),
	audit: () => call<{ id: string; actor_name: string; action: string; target: string; created_at: string }[]>('/audit'),
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
