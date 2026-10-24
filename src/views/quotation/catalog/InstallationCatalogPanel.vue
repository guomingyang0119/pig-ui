<template>
	<div v-loading="busy && !confirming" class="installation-catalog">
		<div v-if="!editing" class="q-section-head">
			<h2>安装销售价指标</h2>
			<el-button :disabled="busy" v-if="canManage" type="primary" @click="seed">从已核对源表建立草稿</el-button>
		</div>
		<section v-if="editing">
			<div class="catalog-version-bar">
				<div>
					<el-tag :type="editing.status === 'draft' ? 'warning' : 'info'" effect="plain">{{ stateLabels[editing.status] }}</el-tag
					><strong>{{ editing.body.name }} · V{{ editing.version }}</strong
					><span class="q-muted">{{ dirty ? '有未保存修改' : editable ? '草稿可编辑' : '此版本只读' }}</span>
				</div>
				<div class="catalog-version-actions">
					<el-button :disabled="busy" @click="versionHistoryVisible = !versionHistoryVisible">版本记录</el-button
					><el-button :disabled="busy" @click="metadataVisible = !metadataVisible">版本信息</el-button>
					<div v-if="canManage" class="q-toolbar">
						<template v-if="editable">
							<el-button :disabled="busy" @click="save">保存草稿</el-button>
							<el-button :disabled="busy || (!editing.id || dirty)" @click="act('trial')">校验指标</el-button>
							<el-button type="primary" :disabled="busy || (!editing.id || dirty)" @click="act('publish')">发布指标</el-button>
							<el-button :disabled="busy" v-if="editing.id" text type="danger" @click="act('delete')">删除草稿</el-button>
						</template>
						<template v-else>
							<el-button :disabled="busy" type="primary" @click="act('revise')">创建新版本</el-button>
							<el-button :disabled="busy" v-if="editing.status === 'published'" @click="act('retire')">停用此版本</el-button>
							<el-button :disabled="busy" v-else @click="act('reactivate')">重新启用</el-button>
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
				<el-button :disabled="busy" v-if="canManage" @click="seed">从已核对源表建立草稿</el-button>
			</div>
			<el-table :data="catalogs" row-key="id" :row-class-name="versionRowClass" class="q-table" style="margin-top: 18px" @row-click="select">
				<el-table-column label="指标名称" min-width="210"
					><template #default="{ row }"
						><el-button :disabled="busy" link type="primary" @click.stop="select(row)">{{ row.body.name }}</el-button></template
					></el-table-column
				>
				<el-table-column prop="version" label="版本" width="70" />
				<el-table-column label="浏览状态" width="110">
					<template #default="{ row }"><el-tag v-if="row.id === editing?.id" size="small" effect="plain">正在查看</el-tag></template>
				</el-table-column>
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
					<button :disabled="busy"
						v-for="item in visibleInstallationDirectory"
						:key="item.id"
						type="button"
						:aria-current="category === item.id ? 'page' : undefined"
						@click="category = item.id"
					>
						{{ item.label }}
					</button>
				</div>
				<button :disabled="busy" type="button" class="catalog-shared-button" :aria-current="category === 'shared' ? 'page' : undefined" @click="category = 'shared'">
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
						><el-select :disabled="busy" v-model="region" aria-label="安装适用地区" placeholder="全部地区" style="width: 180px"
							><el-option label="全部地区" value="" /><el-option v-for="province in regions" :key="province" :label="province" :value="province"
						/></el-select>
						<el-input v-model="search" class="catalog-search" clearable placeholder="搜索当前分类项目或来源" aria-label="搜索安装项目" />
					</div>
					<p class="catalog-scope">同一行适用的省区共用此安装单价，修改后须保存并发布新版本。</p>
					<p v-if="category === 'wrap'" class="catalog-notice">
						外购防火包裹自动采用下表标记「全国统一」的两项安装销售价，组合逐项相加，立方按各材料自身厚度系数换算；安装价不加材料的每平方米加价。
						其他地区项目保留用于独立安装或明确指定的安装规则，不自动用于这批外购材料。
					</p>
					<p v-if="category === 'wrap' && !hasNationalWrapPrices" class="catalog-notice">
						此版本尚未包含全国统一项目，请{{ editable ? '载入全国安装项目' : '点击「创建新版本」' }}，再保存、校验并发布。
						<el-button :disabled="busy" v-if="editable" link type="primary" @click="loadNationalWrap">载入全国安装项目</el-button>
					</p>
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
							><template #default="{ row }">{{ isNationalWrap(row.id) ? '全国统一' : row.regions.join(' / ') }}</template></el-table-column
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
	confirming = ref(false),
	baseline = ref(''),
	region = ref('');
const category = ref('duct'),
	search = ref('');
const isNationalWrap = (id: string) => ['national_wrap_glass', 'national_wrap_board'].includes(id);
const hasNationalWrapPrices = computed(() => (editing.value?.body.projects || []).filter((project) => isNationalWrap(project.id)).length === 2);
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
const editable = computed(() => canManage.value && !busy.value && editing.value?.status === 'draft');
const snapshot = () => JSON.stringify(editing.value?.body);
const dirty = computed(() => !!editing.value && snapshot() !== baseline.value);
const projects = computed(() =>
	[...(editing.value?.body.projects || [])]
		.sort((a, b) => Number(isNationalWrap(b.id)) - Number(isNationalWrap(a.id)))
		.filter(
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
let reloadSequence = 0;
let disposed = false;
async function reload(id?: string, target = editing.value, input = JSON.stringify(target?.body)) {
	const request = ++reloadSequence;
	const loaded = (await quoteApi.resources<InstallationCatalogBody>()).filter((c) => c.kind === 'installation_catalog');
	if (disposed || request !== reloadSequence || editing.value !== target) return false;
	catalogs.value = loaded;
	const item = loaded.find((c) => c.id === id) || loaded[0];
	if (target && JSON.stringify(target.body) !== input) {
		if (item && (!target.id || item.id === target.id)) {
			target.id = item.id;
			target.revision = item.revision;
			baseline.value = JSON.stringify(item.body);
		}
		ElMessage.warning('请求后指标又有修改，已保留最新输入，请重新保存');
		return false;
	}
	setEditing(item);
	return true;
}

/** 存在未保存的安装指标修改时确认是否放弃；取消返回 false，保持当前表单。 */
async function leave() {
	if (busy.value) {
		ElMessage.warning('请求处理中，请完成后再离开或切换版本');
		return false;
	}
	if (!dirty.value) return true;
	try {
		await confirm('安装指标有未保存修改，确定放弃？');
		return true;
	} catch {
		return false;
	}
}
/** 高亮实际正在查看的版本，取消切换时保留原选中行。 */
function versionRowClass({ row }: { row: InstallationCatalog }) {
	return row.id === editing.value?.id ? 'catalog-version-selected' : '';
}
/** 切换指标版本前处理未保存修改，确认后才替换当前编辑副本。 */
async function select(item: InstallationCatalog) {
	if (busy.value || editing.value?.id === item.id) return;
	const target = editing.value;
	if (await leave() && !busy.value && editing.value === target) setEditing(item);
}
async function loadNationalWrap() {
	if (!editable.value || !editing.value) return;
	busy.value = true;
	try {
		const source = await quoteApi.installationSeed();
		const national = source.projects.filter((project) => isNationalWrap(project.id));
		if (national.length !== 2) throw new Error('后端尚未提供全国包裹安装项目，请先更新后端');
		for (const project of national) {
			if (!editing.value.body.projects.some((item) => item.id === project.id)) editing.value.body.projects.push(JSON.parse(JSON.stringify(project)));
		}
		ElMessage.success('全国安装项目已载入，请保存、校验并发布');
	} catch (e) {
		report(e);
	} finally {
		busy.value = false;
	}
}
/** 复用已有安装草稿，或读取已核对源表数据建立未持久化编辑副本；此动作不会直接发布价格。 */
async function seed() {
	if (busy.value) return;
	const target = editing.value;
	if (!(await leave()) || busy.value || editing.value !== target) return;
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
	if (!editing.value || !editable.value || busy.value) return;
	const target = editing.value;
	const submitted = JSON.parse(JSON.stringify(target));
	const input = JSON.stringify(submitted.body);
	busy.value = true;
	try {
		let id = submitted.id;
		if (id) await quoteApi.saveResource(submitted);
		else id = (await quoteApi.createResource(submitted.body, 'installation_catalog')).id;
		if (disposed || editing.value !== target) return;
		if (await reload(id, target, input)) ElMessage.success('安装指标草稿已保存');
	} catch (e) {
		if (!disposed && editing.value === target) report(e);
	} finally {
		if (!disposed) busy.value = false;
	}
}

/** 携带当前修订号执行安装指标校验、发布、修订、停用等生命周期动作，完成后刷新相应版本。 */
async function act(action: string) {
	if (!editing.value || busy.value) return;
	const target = editing.value;
	const input = JSON.stringify(target.body);
	busy.value = true;
	try {
		if (action !== 'trial' && action !== 'revise') {
			// 确认期间保留操作锁，但不显示请求遮罩，以便用户确认或取消。
			confirming.value = true;
			try {
				await confirm(
					{
						publish: '确认发布已核对的安装指标？',
						retire: '确认停用此安装指标版本？',
						reactivate: '确认重新启用此版本？',
						delete: '确认删除此指标草稿？',
					}[action] || '确认执行？'
				);
			} finally {
				confirming.value = false;
			}
		}
		if (disposed || editing.value !== target || JSON.stringify(target.body) !== input) return;
		const result = await quoteApi.resourceAction(JSON.parse(JSON.stringify(target)), action);
		if (disposed || editing.value !== target) return;
		if (action !== 'trial') await reload(result.id || target.id, target, input);
		ElMessage.success(result.message || '安装指标操作完成');
	} catch (e) {
		report(e);
	} finally {
		if (!disposed) busy.value = false;
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
onBeforeUnmount(() => {
	disposed = true;
	reloadSequence++;
	window.removeEventListener('beforeunload', beforeUnload);
});
</script>
