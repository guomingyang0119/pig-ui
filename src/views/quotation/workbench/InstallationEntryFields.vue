<template>
	<el-form :disabled="locked" label-position="top" class="q-grid two installation-entry-form" @submit.prevent>
		<el-alert
			v-if="status === 'pending' && reason"
			type="error"
			show-icon
			:closable="false"
			:title="reason"
			class="q-wide"
		/>
		<el-alert
			v-else-if="editorKind"
			:type="projectKindMismatch ? 'warning' : 'info'"
			:closable="false"
			:title="projectKindMismatch ? '原安装指标与当前产品类型不一致，请重新选择' : `已识别为${editorKindLabel}，仅显示相关安装参数`"
			class="q-wide"
		/>
		<el-alert v-else type="warning" :closable="false" title="产品类型尚未识别，请先确认品类；当前仅显示通用安装参数" class="q-wide" />
		<el-form-item v-if="extra" label="安装名称（独立项目）"><el-input v-model="entry.name" /></el-form-item>
		<el-form-item v-if="extra" label="安装类别">
			<el-select v-model="entry.category" clearable>
				<el-option v-for="category in ['风管', '设备', '防火包裹']" :key="category" :value="category" :label="category" />
			</el-select>
		</el-form-item>
		<el-form-item label="安装指标项目" class="q-wide">
			<el-select
				v-model="entry.project_id"
				filterable
				clearable
				:disabled="!editorKind"
				:placeholder="projectPlaceholder"
			>
				<el-option v-for="project in projects" :key="project.id" :value="project.id" :label="project.name + ' · ' + price(project)" />
			</el-select>
		</el-form-item>
		<p v-if="selectedProject" class="q-muted q-wide">{{ selectedProject.note }}<br />来源：{{ selectedProject.source }}</p>
		<el-form-item label="人工确认安装单价（未税元 / 单位）">
			<el-input v-model="entry.unit_price" placeholder="优先于指标；未确认则留空，0 有效" />
		</el-form-item>
		<el-form-item v-if="isDuctEditor" label="风管成品状态">
			<el-select v-model="entry.product_state" clearable placeholder="产品行明确状态优先">
				<el-option value="semi" label="半成品" /><el-option value="finished" label="成品" />
			</el-select>
		</el-form-item>
		<el-form-item label="安装数量"><el-input v-model="entry.quantity" placeholder="留空沿用客户清单数量" /></el-form-item>
		<el-form-item label="安装单位"><el-input v-model="entry.unit" placeholder="留空沿用客户清单单位；换单位时填写" /></el-form-item>
		<el-form-item v-if="showFanPower" label="风机安装计费功率（kW）">
			<el-input v-model="entry.power" placeholder="双速须确认单一计费功率或安装单价" />
		</el-form-item>
		<el-form-item v-if="showShaanxiAuxiliary" label="风管辅材类型">
			<el-select v-model="entry.auxiliary_type" clearable placeholder="可按所选项目匹配">
				<el-option value="common" label="共板" /><el-option value="angle" label="角铁" /><el-option value="composite" label="复合" />
			</el-select>
		</el-form-item>
		<el-form-item v-if="showOtherAuxiliaryPrice" label="本地区辅材单价（未税元/㎡）">
			<el-input v-model="entry.auxiliary_price" placeholder="非上述五省区且选辅材时填写" />
		</el-form-item>
		<el-form-item label="安装备注"><el-input v-model="entry.note" maxlength="500" /></el-form-item>
		<el-form-item label="安装范围"><el-checkbox v-model="entry.excluded">本项不含安装</el-checkbox></el-form-item>
		<el-form-item v-if="entry.excluded" label="不含安装原因（必填）" class="q-wide">
			<el-input v-model="entry.exclude_reason" maxlength="500" />
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { InstallationCatalogBody, InstallationEntry, InstallationOptions, InstallationProject } from '/@/types/quotation';

const props = defineProps<{
	entry: InstallationEntry;
	options: InstallationOptions;
	rowCategory?: string;
	rowName?: string;
	rowSpec?: string;
	catalog?: InstallationCatalogBody;
	locked: boolean;
	extra?: boolean;
	status?: string;
	reason?: string;
}>();

const region = computed(() => props.options.region.replace(/省$/, '').replace(/壮族自治区$/, ''));
const editorCategory = computed(() => (props.rowCategory || props.entry.category || '').trim());
const editorKind = computed(() => {
	if (!editorCategory.value || editorCategory.value === '待识别') return '';
	if (editorCategory.value === '风管') return 'duct';
	if (editorCategory.value === '防火包裹') return 'wrap';
	return 'equipment';
});
const editorKindLabel = computed(() => ({ duct: '风管产品', equipment: '设备产品', wrap: '防火包裹' }[editorKind.value] || ''));
const projects = computed(() =>
	(props.catalog?.projects || []).filter((project) => project.kind === editorKind.value && project.regions.includes(region.value))
);
const selectedProject = computed(() => props.catalog?.projects.find((project) => project.id === props.entry.project_id));
const projectKindMismatch = computed(() => !!selectedProject.value && !!editorKind.value && selectedProject.value.kind !== editorKind.value);
const isDuctEditor = computed(() => editorKind.value === 'duct');
const productText = computed(() => [props.rowName, props.rowSpec, props.rowCategory, props.entry.name, props.entry.category].filter(Boolean).join(' '));
const isFanEditor = computed(() => /风机|通风机|HTF|HTFC|SWF|GXF|HL3/i.test(productText.value));
const showFanPower = computed(
	() => editorKind.value === 'equipment' && region.value === '陕西' && (isFanEditor.value || !!selectedProject.value?.power_prices?.length)
);
const showShaanxiAuxiliary = computed(() => isDuctEditor.value && region.value === '陕西' && props.options.include_auxiliaries);
const showOtherAuxiliaryPrice = computed(
	() =>
		isDuctEditor.value &&
		!!region.value &&
		props.options.include_auxiliaries &&
		!['贵州', '四川', '云南', '广西', '陕西'].includes(region.value)
);
const projectPlaceholder = computed(() => {
	if (!editorKind.value) return '请先确认产品品类';
	if (!region.value) return '请先填写整单安装省区';
	return '留空则试算时匹配；有歧义须人工选定';
});
const price = (project: InstallationProject) =>
	project.power_prices
		? '<1.5 / 1.5–17.5 / >17.5kW：' + project.power_prices.join(' / ') + '元/' + project.unit
		: project.price + '元/' + project.unit;
</script>

<style scoped>
.installation-entry-form {
	margin-top: 12px;
}
</style>
