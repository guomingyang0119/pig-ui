<template>
	<section class="q-section" v-if="body.installation_options">
		<div class="q-section-head">
			<h2>安装报价</h2>
			<el-checkbox v-model="options.included" :disabled="locked" @change="emit('included-change')">本单包含安装</el-checkbox>
		</div>
		<template v-if="options.included">
			<el-alert v-if="!catalog" type="warning" :closable="false" title="尚无唯一生效的安装指标，请负责人到指标管理的安装指标中核对并发布。" />
			<el-alert
				v-if="body.duct_options.installation_amount"
				type="warning"
				:closable="false"
				:title="'旧版整单安装金额为 ' + body.duct_options.installation_amount + ' 元，请核对后改填下面的安装项目。此金额不自动参与计算。'"
			/>
			<p class="q-muted">
				安装单价为未税销售价。含税订单按每行“安装人工＋辅材”×1.01
				后分别向上取整，不含税订单不乘税率；现场附加费单独计税、取整和列示，不分摊到产品行。材料与安装汇总后统一乘付款系数。
			</p>
			<el-form :disabled="locked" label-position="top" class="q-grid" @submit.prevent>
				<el-form-item label="安装省区"
					><el-select v-model="options.region" filterable allow-create clearable placeholder="可输入其他省区"
						><el-option v-for="region in ['贵州', '四川', '云南', '广西', '陕西']" :key="region" :value="region" :label="region" /></el-select
				></el-form-item>
				<el-form-item v-if="hasDuctRows" label="风管安装辅材"
					><el-checkbox v-model="options.include_auxiliaries">包含辅材</el-checkbox></el-form-item
				>
				<el-form-item label="施工标高（米）"><el-input v-model="options.height" placeholder="按现场填写" /></el-form-item>
				<el-form-item label="施工条件"><el-checkbox v-model="options.cross_work">交叉施工</el-checkbox></el-form-item>
				<el-form-item label="现场附加费"
					><el-checkbox v-model="options.include_site_fee">计取现场附加费（含高空措施费）</el-checkbox></el-form-item
				>
				<el-form-item v-if="options.include_site_fee" label="现场附加费（未税总额 / 元）"
					><el-input v-model="options.site_amount" placeholder="请填写报价人员确认的金额"
				/></el-form-item>
				<el-form-item v-if="options.include_site_fee" label="现场附加费说明" style="grid-column: span 3"
					><el-input v-model="options.site_note" maxlength="500" placeholder="金额大于 0 时必填，例如：高空施工附加费"
				/></el-form-item>
			</el-form>
			<p class="q-muted">{{ siteConditionHint }}</p>
			<div class="q-section-head installation-extras-head">
				<div>
					<h3>独立安装项目</h3>
					<p class="q-muted">客户清单内产品请在“产品报价明细”中处理；这里只添加没有对应产品行的安装项目。</p>
				</div>
				<el-button v-if="!locked" @click="add">＋ 添加独立安装项目</el-button>
			</div>
			<el-table v-if="extraEntries.length" :data="extraEntries" class="q-table" max-height="280" :row-class-name="installationRowClass">
				<el-table-column label="独立安装项目" min-width="190"><template #default="{ row }">{{ row.entry.name || '未命名项目' }}</template></el-table-column>
				<el-table-column label="计算状态" min-width="260">
					<template #default="{ row }">
						<div class="installation-project-status">
							<el-tag v-if="line(row)?.status === 'priced'" type="success" effect="light" size="small">已计算</el-tag>
							<el-tag v-else-if="line(row)?.status === 'pending'" type="danger" effect="dark" size="small">待确认</el-tag>
							<el-tag v-else-if="line(row)?.status === 'excluded'" type="info" effect="plain" size="small">不含安装</el-tag>
							<el-tag v-else type="info" effect="plain" size="small">未计算</el-tag>
							<span>{{ line(row)?.project_name || projectLabel(row.entry.project_id) }}</span>
							<small v-if="line(row)?.status === 'priced'">{{ line(row)?.quantity }} {{ line(row)?.unit }} × {{ line(row)?.unit_price }} 元</small>
							<small v-else-if="line(row)?.reason" class="q-error">{{ line(row)?.reason }}</small>
						</div>
					</template>
				</el-table-column>
				<el-table-column label="安装费" width="120" align="right">
					<template #default="{ row }"><strong v-if="line(row)?.status === 'priced'">{{ money(line(row)?.quoted_amount, 0) }}</strong><span v-else>—</span></template>
				</el-table-column>
				<el-table-column label="操作" width="100">
					<template #default="{ row }"><el-button link :type="line(row)?.status === 'pending' ? 'danger' : 'primary'" @click="edit(row.entry)">{{ locked ? '查看' : '编辑' }}</el-button></template>
				</el-table-column>
			</el-table>
			<el-alert
				v-if="pendingInstallationCount"
				type="error"
				show-icon
				:closable="false"
				:title="`还有 ${pendingInstallationCount} 项安装费用待确认，暂不能形成最终安装合计`"
				style="margin-top: 14px"
			/>
			<p v-if="fee" class="q-muted">
				各行安装费合计 {{ money(fee.line_amount, 0) }} 元；现场附加费 {{ money(fee.site_quoted_amount, 2) }} 元<span v-if="fee.site_note"
					>（{{ fee.site_note }}）</span
				>；安装费用合计
				<strong v-if="fee.status === 'ready'">{{ money(fee.amount, 2) }} 元</strong><strong v-else class="q-error">待确认</strong>。
			</p>
		</template>
		<el-dialog v-model="dialog" title="独立安装项目" width="780px" :close-on-click-modal="false">
			<InstallationEntryFields v-if="draft" :entry="draft" :options="options" :catalog="catalog" :locked="locked" extra />
			<template #footer
				><el-button @click="dialog = false">{{ locked ? '关闭' : '取消' }}</el-button
				><el-button v-if="!locked" type="primary" @click="apply">确认条件</el-button></template
			>
		</el-dialog>
	</section>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { QuoteBody, InstallationCatalogBody, InstallationEntry, InstallationFee, InstallationLine } from '/@/types/quotation';
import { blankInstallation } from '/@/views/quotation/installation';
import { money } from '/@/views/quotation/shared';
import InstallationEntryFields from './InstallationEntryFields.vue';
const props = defineProps<{ body: QuoteBody; locked: boolean; catalog?: InstallationCatalogBody; fee?: InstallationFee }>();
const emit = defineEmits<{ (e: 'included-change'): void }>();
const options = computed(() => props.body.installation_options!);
const hasDuctRows = computed(
	() => props.body.rows.some((row) => row.category === '风管') || (props.body.installation_items || []).some((item) => item.category === '风管')
);
const extraEntries = computed(() =>
	(props.body.installation_items || []).map((entry, index) => ({ entry, lineIndex: props.body.rows.length + index }))
);
const siteConditionHint = computed(
	() => '施工标高和交叉施工仅记录现场工况，不会自动产生费用；需要计取时，请勾选现场附加费并填写金额。'
);
const projectLabel = (id: string) => props.catalog?.projects.find((p) => p.id === id)?.name || (id ? '项目需重新核对' : '系统自动匹配');
const dialog = ref(false),
	draft = ref<InstallationEntry>();
let target: InstallationEntry | undefined;
const pendingInstallationCount = computed(() => props.fee?.lines?.filter((line) => line.status === 'pending').length || 0);
function line(row: { lineIndex: number }): InstallationLine | undefined {
	return props.fee?.lines?.[row.lineIndex];
}
function installationRowClass({ row }: { row: { lineIndex: number } }) {
	const status = line(row)?.status;
	return status === 'pending' ? 'installation-row-pending' : status === 'excluded' ? 'excluded-row' : '';
}
function edit(entry: InstallationEntry) {
	target = entry;
	draft.value = { ...entry };
	dialog.value = true;
}
function add() {
	target = undefined;
	draft.value = blankInstallation();
	dialog.value = true;
}
function apply() {
	if (!draft.value) return;
	if (draft.value.excluded && !draft.value.exclude_reason.trim()) {
		ElMessage.warning('请填写不含安装原因');
		return;
	}
	if (target) Object.assign(target, draft.value);
	else props.body.installation_items!.push({ ...draft.value });
	dialog.value = false;
}
</script>

<style scoped>
.installation-project-status {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 7px;
}
.installation-project-status small {
	display: block;
	width: 100%;
	color: var(--el-text-color-secondary);
}
.installation-pending-reason {
	font-weight: 600;
}
:deep(.q-table .installation-row-pending) {
	--el-table-tr-bg-color: var(--el-color-danger-light-9);
}
:deep(.q-table .installation-row-pending:hover > td.el-table__cell) {
	background-color: var(--el-color-danger-light-8) !important;
}
</style>
