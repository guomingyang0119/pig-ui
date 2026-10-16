<template>
	<!-- 整单安装报价面板：维护安装省区、辅材和现场附加条件，管理独立安装项目，并展示后端逐项安装结果与待确认原因。 -->
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
				<el-form-item v-if="hasDuctRows" label="风管安装辅材"
					><el-checkbox v-model="options.include_auxiliaries">包含辅材</el-checkbox></el-form-item
				>
				<el-form-item label="施工标高（米）"><el-input v-model="options.height" placeholder="按现场填写" /></el-form-item>
				<el-form-item label="施工条件"><el-checkbox v-model="options.cross_work" @change="onCrossWorkChange">交叉施工</el-checkbox></el-form-item>
				<el-form-item v-if="options.cross_work" label="交叉施工费用处理" style="grid-column: span 2">
					<el-radio-group v-model="options.cross_work_fee_decision" @change="onCrossWorkFeeDecisionChange">
						<el-radio value="charge" border>计取现场附加费</el-radio>
						<el-radio value="waive" border>本次不计取</el-radio>
					</el-radio-group>
				</el-form-item>
				<el-form-item v-else label="现场附加费"
					><el-checkbox v-model="options.include_site_fee">计取现场附加费（含高空措施费）</el-checkbox></el-form-item
				>
				<el-form-item v-if="chargesSiteFee" label="现场附加费（未税总额 / 元）"
					><el-input v-model="options.site_amount" placeholder="请填写报价人员确认的金额"
				/></el-form-item>
				<el-form-item v-if="chargesSiteFee" label="现场附加费说明" style="grid-column: span 3"
					><el-input v-model="options.site_note" maxlength="500" placeholder="金额大于 0 时必填，例如：高空施工附加费"
				/></el-form-item>
				<el-form-item v-if="options.cross_work && options.cross_work_fee_decision === 'waive'" label="本次不计取原因" style="grid-column: span 3">
					<el-input v-model="options.site_waive_reason" maxlength="500" placeholder="请填写本次不另行计取现场附加费的原因" />
				</el-form-item>
			</el-form>
			<p class="q-muted">{{ body.project_region_confirmed ? `按${body.project_region}安装规则计价` : '请先在基本信息中确认项目所在省份' }}。{{ siteConditionHint }}</p>
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
				v-if="pendingTotalCount"
				type="error"
				show-icon
				:closable="false"
				:title="pendingSummary"
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
/** 整单安装报价面板：维护安装省区、辅材和现场附加条件，管理独立安装项目，并展示后端逐项安装结果与待确认原因。 */
import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { QuoteBody, InstallationCatalogBody, InstallationEntry, InstallationFee, InstallationLine } from '/@/types/quotation';
import { blankInstallation } from '/@/views/quotation/installation';
import { money } from '/@/views/quotation/shared';
import InstallationEntryFields from './InstallationEntryFields.vue';
/** 直接编辑报价正文中的安装条件；fee 是上次后端计算结果，catalog 提供生效项目参考，包含安装的切换通过事件同步整单付款口径。 */
const props = defineProps<{
	body: QuoteBody;
	locked: boolean;
	catalog?: InstallationCatalogBody;
	fee?: InstallationFee;
	productPendingCount?: number;
}>();
const emit = defineEmits<{ (e: 'included-change'): void }>();
/** 根据整单安装选项决定现场附加费是否计取；交叉施工采用明确的计取/不计取决定。独立项目结果索引接在产品行之后。 */
const options = computed(() => props.body.installation_options!);
const hasDuctRows = computed(
	() => props.body.rows.some((row) => row.category === '风管') || (props.body.installation_items || []).some((item) => item.category === '风管')
);
const chargesSiteFee = computed(() =>
	options.value.cross_work ? options.value.cross_work_fee_decision === 'charge' : options.value.include_site_fee
);
const extraEntries = computed(() =>
	(props.body.installation_items || []).map((entry, index) => ({ entry, lineIndex: props.body.rows.length + index }))
);
const siteConditionHint = computed(
	() =>
		options.value.cross_work
			? '交叉施工必须确认是否计取现场附加费；计取时填写金额和原因，不计取时填写不计取原因。'
			: '施工标高仅记录现场工况；需要计取高空措施费等现场费用时，请勾选现场附加费并填写金额。'
);
const projectLabel = (id: string) => props.catalog?.projects.find((p) => p.id === id)?.name || (id ? '项目需重新核对' : '系统自动匹配');
/** 弹窗使用独立 draft 副本；target 记录待回写的原项目，取消弹窗不会把未确认输入写回报价正文。 */
const dialog = ref(false),
	draft = ref<InstallationEntry>();
let target: InstallationEntry | undefined;
/** 分别汇总产品和安装的待确认数量，提示尚不能形成最终报价，不能把缺失安装价格当作 0。 */
const pendingInstallationCount = computed(() => props.fee?.lines?.filter((line) => line.status === 'pending').length || 0);
const pendingProductCount = computed(() => props.productPendingCount || 0);
const pendingTotalCount = computed(() => pendingProductCount.value + pendingInstallationCount.value);
const pendingSummary = computed(() => {
	const product = pendingProductCount.value;
	const installation = pendingInstallationCount.value;
	return `产品和安装共 ${pendingTotalCount.value} 项待确认（产品 ${product} 项、安装费用 ${installation} 项），暂不能形成最终报价`;
});
/** 切换交叉施工时初始化现场费决定；取消交叉施工会清除专属决定和不计取原因。 */
function onCrossWorkChange(value: boolean | string | number) {
	if (value) options.value.cross_work_fee_decision = options.value.include_site_fee ? 'charge' : '';
	else {
		options.value.cross_work_fee_decision = '';
		options.value.site_waive_reason = '';
	}
}
/** 把明确的交叉施工计取决定同步为现场费开关；选择计取时清除旧的不计取原因。 */
function onCrossWorkFeeDecisionChange(value: string | number | boolean | undefined) {
	options.value.include_site_fee = value === 'charge';
	if (value === 'charge') options.value.site_waive_reason = '';
}
/** 按独立项目在整单安装结果中的索引取计算行，保持页面项目与后端明细顺序对应。 */
function line(row: { lineIndex: number }): InstallationLine | undefined {
	return props.fee?.lines?.[row.lineIndex];
}
/** 待确认安装行高亮，明确排除安装的行弱化显示，便于逐项核对。 */
function installationRowClass({ row }: { row: { lineIndex: number } }) {
	const status = line(row)?.status;
	return status === 'pending' ? 'installation-row-pending' : status === 'excluded' ? 'excluded-row' : '';
}
/** 复制现有独立安装项目到弹窗草稿，确认时才回写当前项目。 */
function edit(entry: InstallationEntry) {
	target = entry;
	draft.value = { ...entry };
	dialog.value = true;
}
/** 创建空白独立安装项目；它只增加安装条目，不增加材料供货行。 */
function add() {
	target = undefined;
	draft.value = blankInstallation();
	dialog.value = true;
}
/** 确认安装条件前检查不含安装原因，再更新原项目或追加新项目。这里只应用到页面草稿，仍需整单保存并试算。 */
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
