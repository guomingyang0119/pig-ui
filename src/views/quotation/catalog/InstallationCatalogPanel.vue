<template>
	<!-- 安装指标维护面板：从已核对基准数据准备草稿，负责人保存、校验和发布版本；已发布指标只读，调价通过新版本执行。 -->
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
/** 安装指标维护面板：从已核对基准数据准备草稿，负责人保存、校验和发布版本；已发布指标只读，调价通过新版本执行。 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { ElMessage } from 'element-plus';
import { auth } from '/@/utils/authFunction';
import { quoteApi } from '/@/api/quotation';
import { confirm, report, stateLabels } from '/@/views/quotation/shared';
import type { Catalog, InstallationCatalogBody } from '/@/types/quotation';
type InstallationCatalog = Catalog<InstallationCatalogBody>;
/** 安装指标版本列表与 editing 编辑副本分开保存；baseline 用于发现未保存修改，避免直接污染列表或历史版本。 */
const catalogs = ref<InstallationCatalog[]>([]),
	editing = ref<InstallationCatalog>(),
	busy = ref(false),
	baseline = ref(''),
	region = ref('');
/** 只有具备 quote_manage 权限且当前为草稿时允许编辑；接口仍负责最终权限、版本及状态校验。 */
const canManage = computed(() => auth('quote_manage'));
const editable = computed(() => canManage.value && editing.value?.status === 'draft');
const snapshot = () => JSON.stringify(editing.value?.body);
const dirty = computed(() => !!editing.value && snapshot() !== baseline.value);
const projects = computed(() => (editing.value?.body.projects || []).filter((p) => !region.value || p.regions.includes(region.value)));
/** 深拷贝选中指标并建立基线，保证表单修改只作用于当前编辑副本。 */
function setEditing(item?: InstallationCatalog) {
	editing.value = item ? JSON.parse(JSON.stringify(item)) : undefined;
	baseline.value = snapshot();
}
/** 查询资源后仅保留安装指标，优先重新选中指定版本，再更新编辑副本与保存基线。 */
async function reload(id?: string) {
	catalogs.value = (await quoteApi.resources<InstallationCatalogBody>()).filter((c) => c.kind === 'installation_catalog');
	setEditing(catalogs.value.find((c) => c.id === id) || catalogs.value[0]);
}
/** 存在未保存的安装指标修改时确认是否放弃；取消返回 false，保持当前表单。 */
async function leave() {
	if (!dirty.value) return true;
	try {
		await confirm('安装指标有未保存修改，确定放弃？');
		return true;
	} catch {
		return false;
	}
}
/** 切换指标版本前处理未保存修改，确认后才替换当前编辑副本。 */
async function select(item: InstallationCatalog) {
	if (await leave()) setEditing(item);
}
/** 复用已有安装草稿，或读取已核对源表数据建立未持久化编辑副本；此动作不会直接发布价格。 */
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
/** 已有安装指标按 revision 保存，新建源表副本先创建资源；成功后重新读取版本，更新并发修订号和基线。 */
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
/** 携带当前修订号执行安装指标校验、发布、修订、停用等生命周期动作，完成后刷新相应版本。 */
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
/** 页面关闭或刷新时，对尚未保存的指标修改触发浏览器离开提示。 */
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
