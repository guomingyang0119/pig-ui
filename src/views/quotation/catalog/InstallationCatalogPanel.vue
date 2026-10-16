<template>
	<div v-loading="busy" class="installation-catalog">
		<div v-if="!editing" class="q-section-head">
			<h2>安装销售价指标</h2>
			<el-button v-if="canManage" type="primary" @click="seed">从已核对源表建立草稿</el-button>
		</div>
		<section v-if="editing">
			<div class="catalog-version-bar">
				<div>
					<el-tag :type="editing.status === 'draft' ? 'warning' : 'info'" effect="plain">{{ stateLabels[editing.status] }}</el-tag
					><strong>{{ editing.body.name }} · V{{ editing.version }}</strong
					><span class="q-muted">{{ dirty ? '有未保存修改' : editable ? '草稿可编辑' : '此版本只读' }}</span>
				</div>
				<div class="catalog-version-actions">
					<el-button @click="versionHistoryVisible = !versionHistoryVisible">版本记录</el-button
					><el-button @click="metadataVisible = !metadataVisible">版本信息</el-button>
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
			</div>
			<div v-show="metadataVisible" class="catalog-metadata">
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
			</div>
		</section>
		<div v-show="versionHistoryVisible || !editing" class="catalog-versions">
			<div class="q-section-head">
				<h3>安装指标版本</h3>
				<el-button v-if="canManage" @click="seed">从已核对源表建立草稿</el-button>
			</div>
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
		</div>
		<div v-if="editing" class="catalog-layout">
			<nav class="catalog-directory" aria-label="安装指标目录">
				<p class="catalog-directory-label">安装项目</p>
				<div class="catalog-product-list">
					<button
						v-for="item in visibleInstallationDirectory"
						:key="item.id"
						type="button"
						:aria-current="category === item.id ? 'page' : undefined"
						@click="category = item.id"
					>
						{{ item.label }}
					</button>
				</div>
				<button type="button" class="catalog-shared-button" :aria-current="category === 'shared' ? 'page' : undefined" @click="category = 'shared'">
					共用安装设置
				</button>
			</nav>
			<div class="catalog-product-content">
				<p class="q-muted catalog-breadcrumb">安装指标 / {{ category === 'shared' ? '共用设置' : '项目分类' }}</p>
				<div class="q-section-head">
					<h2>{{ categoryLabel }}</h2>
					<el-tag type="info" effect="plain">{{ category === 'shared' ? '本版本共用' : '未税销售单价' }}</el-tag>
				</div>
				<template v-if="category !== 'shared'">
					<div class="catalog-region-filter">
						<span>适用地区</span
						><el-select v-model="region" aria-label="安装适用地区" placeholder="全部地区" style="width: 180px"
							><el-option label="全部地区" value="" /><el-option v-for="province in regions" :key="province" :label="province" :value="province"
						/></el-select>
						<el-input v-model="search" class="catalog-search" clearable placeholder="搜索当前分类项目或来源" aria-label="搜索安装项目" />
					</div>
					<p class="catalog-scope">同一行列出的省区共用此安装单价，修改会同步影响这些省区；组合项目保持原表计价口径。</p>
					<p v-if="category === 'fan'" class="catalog-rule-note">陕西部分风机按低于 1.5kW、1.5–17.5kW（含）、高于 17.5kW 三档维护安装单价。</p>
					<section v-if="category === 'auxiliary' && (!region || ['贵州', '四川', '云南', '广西'].includes(region))" class="catalog-product-section">
						<el-form :disabled="!editable" label-position="top" @submit.prevent
							><el-form-item label="贵州 / 四川 / 云南 / 广西风管辅材（元/㎡）"
								><el-input v-model="editing.body.four_auxiliary_price" aria-label="四省风管安装辅材单价" style="max-width: 260px" /></el-form-item
						></el-form>
						<p class="catalog-scope">以上四省共用此辅材价格；陕西按下表中的辅材项目分别维护。</p>
					</section>
					<el-table :data="projects" class="q-table" max-height="620" empty-text="当前筛选下暂无安装项目，请调整地区或搜索条件">
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
					<p class="catalog-footer">当前显示 {{ projects.length }} 条，本版本共 {{ editing.body.projects.length }} 条安装项目。</p>
				</template>
				<section v-else class="catalog-product-section">
					<h3>安装税费</h3>
					<p class="catalog-scope">含税订单统一使用此系数；安装项目按未税销售价维护。</p>
					<el-form label-position="top" @submit.prevent
						><el-form-item label="含税订单安装系数（固定）"
							><el-input :model-value="editing.body.tax_factor" aria-label="含税订单安装系数" readonly style="max-width: 260px" /></el-form-item
					></el-form>
				</section>
				<details class="catalog-advanced">
					<summary>来源记录</summary>
					<p class="q-muted catalog-source">{{ editing.body.source }}</p>
					<p class="q-muted catalog-source">源文件 SHA-256：{{ editing.body.source_sha256 }}</p>
				</details>
			</div>
		</div>
		<p v-if="editing" class="catalog-footer">各类安装项目共用当前安装指标版本。修改后请保存、校验并发布，已发布版本只读。</p>
	</div>
</template>
<script setup lang="ts">
/** 安装指标维护面板：从已核对基准数据准备草稿，负责人保存、校验和发布版本；已发布指标只读，调价通过新版本执行。 */
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { ElMessage } from 'element-plus';
import { auth } from '/@/utils/authFunction';
import { quoteApi } from '/@/api/quotation';
import { confirm, report, stateLabels } from '/@/views/quotation/shared';
import { installationDirectory, installationGroup } from './indicatorDirectory';
import type { Catalog, InstallationCatalogBody } from '/@/types/quotation';
type InstallationCatalog = Catalog<InstallationCatalogBody>;
/** 安装指标版本列表与 editing 编辑副本分开保存；baseline 用于发现未保存修改，避免直接污染列表或历史版本。 */
const catalogs = ref<InstallationCatalog[]>([]),
	editing = ref<InstallationCatalog>(),
	busy = ref(false),
	baseline = ref(''),
	region = ref('');
const category = ref('duct'),
	search = ref('');
watch(category, () => (search.value = ''));
const versionHistoryVisible = ref(false),
	metadataVisible = ref(false);
const visibleInstallationDirectory = computed(() =>
	installationDirectory.filter(
		(item) => item.id === 'auxiliary' || (editing.value?.body.projects || []).some((project) => installationGroup(project) === item.id)
	)
);
const categoryLabel = computed(() =>
	category.value === 'shared' ? '共用安装设置' : installationDirectory.find((item) => item.id === category.value)?.label
);
const regions = computed(() => [...new Set((editing.value?.body.projects || []).flatMap((project) => project.regions))]);
/** 只有具备 quote_manage 权限且当前为草稿时允许编辑；接口仍负责最终权限、版本及状态校验。 */
const canManage = computed(() => auth('quote_manage'));
const editable = computed(() => canManage.value && editing.value?.status === 'draft');
const snapshot = () => JSON.stringify(editing.value?.body);
const dirty = computed(() => !!editing.value && snapshot() !== baseline.value);
const projects = computed(() =>
	(editing.value?.body.projects || []).filter(
		(p) =>
			installationGroup(p) === category.value &&
			(!region.value || p.regions.includes(region.value)) &&
			(!search.value.trim() || (p.name + ' ' + p.source).toLowerCase().includes(search.value.trim().toLowerCase()))
	)
);
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
