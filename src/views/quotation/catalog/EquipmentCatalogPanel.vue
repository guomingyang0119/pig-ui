<template>
	<!-- 设备指标维护面板：从已核对基准数据准备草稿，负责人保存、校验和发布版本；已发布指标只读，调价通过新版本执行。 -->
	<div v-loading="busy">
		<div class="q-section-head" style="margin: 14px 0">
			<div>
				<h2>设备供货指标</h2>
				<p class="q-muted">成本、选型工况与来源按版本保存；核对后发布，新试算使用生效版本。</p>
			</div>
			<el-button v-if="canManage" type="primary" @click="seed">从已核对源表建立草稿</el-button>
		</div>
		<el-alert
			title="安装费用在安装指标中独立配置。已发布指标只读；调价请创建新版本。待确认的选型或缺失成本不会自动补价。"
			type="info"
			:closable="false"
		/>
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
			<el-table-column label="选型 / 电机价格" min-width="180"
				><template #default="{ row }">{{ row.body.fan_points.length }} 条工况 / {{ row.body.motors.length }} 条电机</template></el-table-column
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
			<el-tabs v-model="tab">
				<el-tab-pane label="供货价格与边界" name="rates">
					<el-form :disabled="!editable" label-position="top" class="q-grid" @submit.prevent>
						<el-form-item v-for="(_, key) in editing.body.rates" :key="key" :label="equipmentRates[key] || key"
							><el-input v-model="editing.body.rates[key]" :readonly="key === 'check_splice'"
						/></el-form-item>
					</el-form>
				</el-tab-pane>
				<el-tab-pane label="运费与付款" name="payment">
					<el-form :disabled="!editable" label-position="top" class="q-grid" @submit.prevent>
						<el-form-item v-for="(_, region) in editing.body.regions" :key="region" :label="region + '运费系数'"
							><el-input v-model="editing.body.regions[region]"
						/></el-form-item>
						<el-form-item v-for="term in editing.body.payment_terms" :key="term.code" :label="term.label"
							><el-input v-model="term.coefficient"
						/></el-form-item>
					</el-form>
				</el-tab-pane>
				<el-tab-pane label="材料、电机与外购价格" name="prices">
					<el-collapse>
						<el-collapse-item
							v-for="group in priceGroups"
							:key="group.key"
							:name="group.key"
							:title="group.label + ' · ' + editing.body[group.key].length + ' 条'"
						>
							<el-table :data="editing.body[group.key]" max-height="480" class="q-table">
								<el-table-column label="材质 / 型号" min-width="200"
									><template #default="{ row }"
										>{{ row.model || row.material }} {{ row.thickness ? row.thickness + 'mm' : '' }}</template
									></el-table-column
								>
								<el-table-column label="名称 / 功率 / 极数" min-width="200"
									><template #default="{ row }">{{
										row.name || (row.powers ? [row.powers.join('/') + ' kW', row.poles?.join('/') + ' 极'].join(' · ') : '板材')
									}}</template></el-table-column
								>
								<el-table-column :label="group.key === 'materials' ? '吨价（元/吨）' : '不含税成本（元）'" width="170"
									><template #default="{ row }"><el-input v-model="row[group.price]" :disabled="!editable" /></template
								></el-table-column>
								<el-table-column prop="source" label="来源单元格" min-width="220" />
							</el-table>
						</el-collapse-item>
					</el-collapse>
				</el-tab-pane>
				<el-tab-pane label="阀体成本公式" name="formulas">
					<p class="q-muted">各公式计算一个成本分项，机构、拼接和面板按产品规则另加。编辑使用英文变量名，下面显示中文对照。</p>
					<el-form :disabled="!editable" label-position="top" @submit.prevent>
						<section v-for="(_, key) in editing.body.valve_expressions" :key="key" class="q-formula">
							<el-form-item :label="equipmentComponents[key] || key"><el-input v-model="editing.body.valve_expressions[key]" /></el-form-item>
							<p class="q-formula-preview"><span>中文对照</span>{{ chineseFormula(editing.body.valve_expressions[key]) }}</p>
						</section>
					</el-form>
					<el-table :data="Object.entries(equipmentVariables).map(([key, label]) => ({ key, label }))" class="q-table">
						<el-table-column prop="key" label="英文参数" /><el-table-column prop="label" label="中文含义 / 单位" />
					</el-table>
				</el-tab-pane>
				<el-tab-pane label="设备参数与选型" name="advanced" lazy>
					<EquipmentParameters :catalog="editing.body" :editable="editable" @pending-change="pendingParameterChange = $event" />
				</el-tab-pane>
				<el-tab-pane label="来源记录" name="sources">
					<el-table :data="editing.body.source_files" class="q-table"
						><el-table-column prop="name" label="源文件" min-width="230" /><el-table-column prop="sha256" label="文件 SHA-256" min-width="420"
					/></el-table>
				</el-tab-pane>
			</el-tabs>
		</section>
	</div>
</template>
<script setup lang="ts">
/** 设备指标维护面板：从已核对基准数据准备草稿，负责人保存、校验和发布版本；已发布指标只读，调价通过新版本执行。 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { ElMessage } from 'element-plus';
import { auth } from '/@/utils/authFunction';
import { quoteApi } from '/@/api/quotation';
import { confirm, report, stateLabels } from '/@/views/quotation/shared';
import { equipmentRates, equipmentComponents, equipmentVariables, equipmentFormulaInChinese as chineseFormula } from '/@/views/quotation/equipment';
import EquipmentParameters from './EquipmentParameters.vue';
import type { Catalog, EquipmentCatalogBody } from '/@/types/quotation';
type EquipmentCatalog = Catalog<EquipmentCatalogBody>;
/** 设备指标版本列表与 editing 编辑副本分开保存；baseline 用于发现未保存修改，避免直接污染列表或历史版本。 */
const catalogs = ref<EquipmentCatalog[]>([]),
	editing = ref<EquipmentCatalog>(),
	busy = ref(false),
	baseline = ref(''),
	tab = ref('rates');
/** 子参数弹窗中尚未应用的修改也计入 dirty，防止只比较主表正文时遗漏未保存的工况输入。 */
const pendingParameterChange = ref(false);
/** 只有具备 quote_manage 权限且当前为草稿时允许编辑；接口仍负责最终权限、版本及状态校验。 */
const canManage = computed(() => auth('quote_manage'));
const editable = computed(() => canManage.value && editing.value?.status === 'draft');
const snapshot = () => JSON.stringify(editing.value?.body);
const dirty = computed(() => !!editing.value && (snapshot() !== baseline.value || pendingParameterChange.value));
const priceGroups = [
	{ key: 'materials' as const, label: '不锈钢板材吨价', price: 'ton_price' },
	{ key: 'motors' as const, label: '电机成本', price: 'cost' },
	{ key: 'purchased' as const, label: '外购设备', price: 'cost' },
];
/** 深拷贝选中指标并建立基线，保证表单修改只作用于当前编辑副本。 */
function setEditing(item?: EquipmentCatalog) {
	editing.value = item ? JSON.parse(JSON.stringify(item)) : undefined;
	pendingParameterChange.value = false;
	baseline.value = snapshot();
}
/** 查询资源后仅保留设备指标，优先重新选中指定版本，再更新编辑副本与保存基线。 */
async function reload(id?: string) {
	catalogs.value = (await quoteApi.resources<EquipmentCatalogBody>()).filter((c) => c.kind === 'equipment_catalog');
	setEditing(catalogs.value.find((c) => c.id === id) || catalogs.value[0]);
}
/** 存在未保存的设备指标修改时确认是否放弃；取消返回 false，保持当前表单。 */
async function leave() {
	if (!dirty.value) return true;
	try {
		await confirm('设备指标有未保存修改，确定放弃？');
		return true;
	} catch {
		return false;
	}
}
/** 切换指标版本前处理未保存修改，确认后才替换当前编辑副本。 */
async function select(item: EquipmentCatalog) {
	if (await leave()) setEditing(item);
}
/** 复用已有设备草稿，或读取已核对源表数据建立未持久化编辑副本；此动作不会直接发布价格。 */
async function seed() {
	if (!(await leave())) return;
	busy.value = true;
	try {
		const draft = catalogs.value.find((c) => c.status === 'draft');
		if (draft) setEditing(draft);
		else {
			setEditing({ id: '', family: '', kind: 'equipment_catalog', version: 1, revision: 0, status: 'draft', body: await quoteApi.equipmentSeed() });
			baseline.value = '';
		}
	} catch (e) {
		report(e);
	} finally {
		busy.value = false;
	}
}
/** 已有设备指标按 revision 保存，新建源表副本先创建资源；成功后重新读取版本，更新并发修订号和基线。 */
async function save() {
	if (!editing.value) return;
	busy.value = true;
	try {
		let id = editing.value.id;
		if (id) await quoteApi.saveResource(editing.value);
		else id = (await quoteApi.createResource(editing.value.body, 'equipment_catalog')).id;
		await reload(id);
		ElMessage.success('设备指标草稿已保存');
	} catch (e) {
		report(e);
	} finally {
		busy.value = false;
	}
}
/** 携带当前修订号执行设备指标校验、发布、修订、停用等生命周期动作，完成后刷新相应版本。 */
async function act(action: string) {
	if (!editing.value) return;
	try {
		if (action !== 'trial' && action !== 'revise')
			await confirm(
				{
					publish: '确认发布已核对的设备指标？',
					retire: '确认停用此设备指标版本？',
					reactivate: '确认重新启用此版本？',
					delete: '确认删除此指标草稿？',
				}[action] || '确认执行？'
			);
		busy.value = true;
		const result = await quoteApi.resourceAction(editing.value, action);
		if (action !== 'trial') await reload(result.id || editing.value.id);
		ElMessage.success(result.message || '设备指标操作完成');
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
