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
