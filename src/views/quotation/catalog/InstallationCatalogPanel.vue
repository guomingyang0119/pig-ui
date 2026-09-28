<template>
	<div v-loading="busy">
		<div class="q-section-head" style="margin: 14px 0">
			<div>
				<h2>安装销售价指标</h2>
				<p class="q-muted">52 个安装项目按地区和来源保存；全部为未税销售单价，核对后发布。</p>
			</div>
			<el-button v-if="canManage" type="primary" @click="seed">从已核对源表建立草稿</el-button>
		</div>
		<el-alert title="含税订单的安装含税系数为 1.01；陕西风机分三档。已发布指标只读，调价请创建新版本。" type="info" :closable="false" />
		<el-table :data="catalogs" class="q-table" style="margin-top: 18px" @row-click="select">
			<el-table-column label="指标名称" min-width="210"
				><template #default="{ row }"
					><el-button link type="primary" @click.stop="select(row)">{{ row.body.name }}</el-button></template
				></el-table-column
			>
			<el-table-column prop="version" label="版本" width="70" />
			<el-table-column label="状态" width="100"
				><template #default="{ row }">{{ stateLabels[row.status] }}</template></el-table-column
			>
			<el-table-column label="安装项目" min-width="180"
				><template #default="{ row }">{{ row.body.projects.length }} 项</template></el-table-column
			>
			<el-table-column label="生效日期" min-width="160"
				><template #default="{ row }">{{ row.body.effective_from }}</template></el-table-column
			>
		</el-table>
		<section v-if="editing" class="q-section">
			<div class="q-section-head">
				<div>
					<h2>{{ editing.body.name }} · V{{ editing.version }}</h2>
					<p class="q-muted">{{ dirty ? '有未保存修改' : editable ? '草稿可编辑' : '此版本只读' }}</p>
				</div>
				<div v-if="canManage" class="q-toolbar">
					<template v-if="editable">
						<el-button @click="save">保存草稿</el-button>
						<el-button :disabled="!editing.id || dirty" @click="act('trial')">校验指标</el-button>
						<el-button type="primary" :disabled="!editing.id || dirty" @click="act('publish')">发布指标</el-button>
						<el-button v-if="editing.id" text type="danger" @click="act('delete')">删除草稿</el-button>
					</template>
					<template v-else>
						<el-button type="primary" @click="act('revise')">创建新版本</el-button>
						<el-button v-if="editing.status === 'published'" @click="act('retire')">停用此版本</el-button>
						<el-button v-else @click="act('reactivate')">重新启用</el-button>
					</template>
				</div>
			</div>
			<el-form :disabled="!editable" label-position="top" class="q-grid" @submit.prevent>
				<el-form-item label="指标名称"><el-input v-model="editing.body.name" /></el-form-item>
				<el-form-item label="生效日期"
					><el-date-picker v-model="editing.body.effective_from" value-format="YYYY-MM-DD" :clearable="false"
				/></el-form-item>
				<el-form-item label="失效日期（可留空）"
					><el-date-picker v-model="editing.body.effective_to" value-format="YYYY-MM-DD" @change="editing.body.effective_to ||= ''"
				/></el-form-item>
				<el-form-item label="来源"><el-input v-model="editing.body.source" /></el-form-item>
			</el-form>

			<el-form :disabled="!editable" label-position="top" class="q-grid" @submit.prevent>
				<el-form-item label="含税订单安装系数（固定）"><el-input :model-value="editing.body.tax_factor" readonly /></el-form-item>
				<el-form-item label="贵州 / 四川 / 云南 / 广西风管辅材（元/㎡）"><el-input v-model="editing.body.four_auxiliary_price" /></el-form-item>
			</el-form>
			<el-radio-group v-model="region" style="margin: 16px 0"
				><el-radio-button label="全部" value="" /><el-radio-button label="贵州 / 四川 / 云南 / 广西" value="贵州" /><el-radio-button
					label="陕西"
					value="陕西"
			/></el-radio-group>
			<el-table :data="projects" class="q-table" max-height="620">
				<el-table-column prop="name" label="原表项目名称" min-width="250" />
				<el-table-column label="省区" width="150"
					><template #default="{ row }">{{ row.regions.join(' / ') }}</template></el-table-column
				>
				<el-table-column prop="unit" label="单位" width="65" />
				<el-table-column label="未税安装销售单价（元）" min-width="255"
					><template #default="{ row }">
						<template v-if="row.power_prices"
							><div
								v-for="(label, i) in ['低于 1.5kW', '1.5–17.5kW（含）', '高于 17.5kW']"
								:key="label"
								style="display: flex; align-items: center; margin: 6px 0; gap: 8px"
							>
								<span style="width: 160px">{{ label }}</span
								><el-input v-model="row.power_prices[i]" :disabled="!editable" :aria-label="row.name + label" /></div
						></template>
						<el-input v-else v-model="row.price" :disabled="!editable" :aria-label="row.name + '安装单价'" /> </template
				></el-table-column>
				<el-table-column label="来源与适用说明" min-width="350"
					><template #default="{ row }"
						><p>{{ row.source }}</p>
						<p class="q-muted">{{ row.note }}</p></template
					></el-table-column
				>
			</el-table>
			<p class="q-muted">源文件 SHA-256：{{ editing.body.source_sha256 }}</p>
		</section>
	</div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { ElMessage } from 'element-plus';
import { auth } from '/@/utils/authFunction';
import { quoteApi } from '/@/api/quotation';
import { confirm, report, stateLabels } from '/@/views/quotation/shared';
import type { Catalog, InstallationCatalogBody } from '/@/types/quotation';
type InstallationCatalog = Catalog<InstallationCatalogBody>;
const catalogs = ref<InstallationCatalog[]>([]),
	editing = ref<InstallationCatalog>(),
	busy = ref(false),
	baseline = ref(''),
	region = ref('');
const canManage = computed(() => auth('quote_manage'));
const editable = computed(() => canManage.value && editing.value?.status === 'draft');
const snapshot = () => JSON.stringify(editing.value?.body);
const dirty = computed(() => !!editing.value && snapshot() !== baseline.value);
const projects = computed(() => (editing.value?.body.projects || []).filter((p) => !region.value || p.regions.includes(region.value)));
function setEditing(item?: InstallationCatalog) {
	editing.value = item ? JSON.parse(JSON.stringify(item)) : undefined;
	baseline.value = snapshot();
}
async function reload(id?: string) {
	catalogs.value = (await quoteApi.resources<InstallationCatalogBody>()).filter((c) => c.kind === 'installation_catalog');
	setEditing(catalogs.value.find((c) => c.id === id) || catalogs.value[0]);
}
async function leave() {
	if (!dirty.value) return true;
	try {
		await confirm('安装指标有未保存修改，确定放弃？');
		return true;
	} catch {
		return false;
	}
}
async function select(item: InstallationCatalog) {
	if (await leave()) setEditing(item);
}
async function seed() {
	if (!(await leave())) return;
	busy.value = true;
	try {
		const draft = catalogs.value.find((c) => c.status === 'draft');
		if (draft) setEditing(draft);
		else {
			setEditing({
				id: '',
				family: '',
				kind: 'installation_catalog',
				version: 1,
				revision: 0,
				status: 'draft',
				body: await quoteApi.installationSeed(),
			});
			baseline.value = '';
		}
	} catch (e) {
		report(e);
	} finally {
		busy.value = false;
	}
}
async function save() {
	if (!editing.value) return;
	busy.value = true;
	try {
		let id = editing.value.id;
		if (id) await quoteApi.saveResource(editing.value);
		else id = (await quoteApi.createResource(editing.value.body, 'installation_catalog')).id;
		await reload(id);
		ElMessage.success('安装指标草稿已保存');
	} catch (e) {
		report(e);
	} finally {
		busy.value = false;
	}
}
async function act(action: string) {
	if (!editing.value) return;
	try {
		if (action !== 'trial' && action !== 'revise')
			await confirm(
				{
					publish: '确认发布已核对的安装指标？',
					retire: '确认停用此安装指标版本？',
					reactivate: '确认重新启用此版本？',
					delete: '确认删除此指标草稿？',
				}[action] || '确认执行？'
			);
		busy.value = true;
		const result = await quoteApi.resourceAction(editing.value, action);
		if (action !== 'trial') await reload(result.id || editing.value.id);
		ElMessage.success(result.message || '安装指标操作完成');
	} catch (e) {
		report(e);
	} finally {
		busy.value = false;
	}
}
function beforeUnload(event: BeforeUnloadEvent) {
	if (dirty.value) {
		event.preventDefault();
		event.returnValue = '';
	}
}
onBeforeRouteLeave(leave);
onMounted(async () => {
	window.addEventListener('beforeunload', beforeUnload);
	try {
		await reload();
	} catch (e) {
		report(e);
	}
});
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload));
</script>
