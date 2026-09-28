<template>
	<div>
		<div class="q-section-head">
			<el-input v-model="search" placeholder="搜索客户或项目" clearable class="q-search" aria-label="搜索报价" />
			<div class="q-toolbar">
				<el-radio-group v-model="archived" @change="load"
					><el-radio-button :value="false">当前报价</el-radio-button><el-radio-button :value="true">已归档</el-radio-button></el-radio-group
				>
				<el-button @click="load" :loading="busy">刷新</el-button>
			</div>
		</div>
		<el-table :data="filtered" v-loading="busy" class="q-table" empty-text="暂无报价，点击新建或导入客户清单" @row-dblclick="open">
			<el-table-column label="客户 / 项目" min-width="220"
				><template #default="{ row }">
					<button class="q-inline-link" @click="open(row)">{{ row.customer || '未填写客户' }}</button>
					<div class="q-muted">{{ row.project || '未填写项目' }}</div>
				</template></el-table-column
			>
			<el-table-column prop="quote_date" label="报价日期" width="120" />
			<el-table-column label="清单识别" width="100"
				><template #default="{ row }">{{ row.recognition_mode === 'auto_v1' ? '自动识别' : '历史清单' }}</template></el-table-column
			>
			<el-table-column label="版本" width="75"
				><template #default="{ row }">V{{ row.version }}</template></el-table-column
			>
			<el-table-column label="状态" width="100"
				><template #default="{ row }"
					><el-tag :type="row.state === 'final' ? 'success' : 'info'" effect="plain">{{ stateLabels[row.state] }}</el-tag></template
				></el-table-column
			>
			<el-table-column prop="row_count" label="项目数" width="85" />
			<el-table-column label="报价总额（元）" min-width="155" align="right"
				><template #default="{ row }"
					><span class="q-number">{{ money(row.total, row.pricing_mode === 'equipment_v1' ? 0 : 1) }}</span></template
				></el-table-column
			>
			<el-table-column label="操作" width="220" fixed="right"
				><template #default="{ row }">
					<el-button link type="primary" @click="open(row)">打开</el-button>
					<template v-if="canEdit">
						<el-button v-if="row.state === 'archived'" link @click="act(row, 'restore')">恢复</el-button>
						<template v-else>
							<el-button link @click="act(row, 'revise')">修订</el-button>
							<el-button v-if="row.export_count" link @click="act(row, 'archive')">归档</el-button>
							<el-button v-else-if="row.state === 'draft'" link type="danger" @click="act(row, 'delete')">删除</el-button>
						</template>
					</template>
				</template></el-table-column
			>
		</el-table>
		<p v-if="failed" class="q-error" style="margin-top: 16px">列表加载失败。请确认服务、报价业务表和账号权限已就绪，再点击刷新。</p>
		<p class="q-muted" style="margin-top: 16px">{{ filtered.length }} 份报价 · 普通报价员查看自己的单据，报价负责人查看全部。</p>
	</div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { auth } from '/@/utils/authFunction';
import { quoteApi } from '/@/api/quotation';
import { stateLabels, money, report, confirm } from '/@/views/quotation/shared';
import type { QuoteSummary } from '/@/types/quotation';
const router = useRouter(),
	items = ref<QuoteSummary[]>([]),
	search = ref(''),
	archived = ref(false),
	busy = ref(false),
	failed = ref(false);
const canEdit = computed(() => auth('quote_edit'));
const filtered = computed(() => items.value.filter((q) => (q.customer + ' ' + q.project).toLowerCase().includes(search.value.toLowerCase())));
function open(row: { id: string }) {
	router.push({ path: '/quotation/workbench/index', query: { id: row.id } });
}
async function load() {
	busy.value = true;
	failed.value = false;
	try {
		items.value = await quoteApi.list(archived.value);
	} catch (error) {
		failed.value = true;
		report(error);
	} finally {
		busy.value = false;
	}
}
async function act(row: QuoteSummary, action: string) {
	const text: Record<string, string> = {
		delete: '永久删除这份未导出的草稿？此操作不能恢复。',
		archive: '归档这份报价？历史导出文件会保留。',
		restore: '恢复报价到归档前的状态？',
		revise: '创建新的报价版本？历史版本和导出文件会保留。',
	};
	try {
		await confirm(text[action]);
		const result = await quoteApi.action(row.id, row.revision, action);
		if (result.id) open({ id: result.id });
		else await load();
	} catch (error) {
		report(error);
	}
}
onMounted(load);
defineExpose({ load });
</script>
