<template>
	<!-- 单项安装条件表单，同时用于产品行与独立安装项目。根据产品类别和安装地区提供项目选择、人工单价及必要的辅材或功率参数。 -->
	<el-form :disabled="locked" label-position="top" class="q-grid two installation-entry-form" @submit.prevent>
		<el-alert v-if="status === 'pending' && reason" type="error" show-icon :closable="false" :title="reason" class="q-wide" />
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
			<el-select v-model="entry.project_id" filterable clearable :disabled="locked || !editorKind" :placeholder="projectPlaceholder">
				<el-option v-for="project in projects" :key="project.id" :value="project.id" :label="project.name + ' · ' + price(project)" />
			</el-select>
		</el-form-item>
		<p v-if="wrapAutomaticHint" class="q-muted q-wide">{{ wrapAutomaticHint }}</p>
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
/** 单项安装条件表单，同时用于产品行与独立安装项目。根据产品类别和安装地区提供项目选择、人工单价及必要的辅材或功率参数。 */
import { computed } from 'vue';
import type { InstallationCatalogBody, InstallationEntry, InstallationOptions, InstallationProject } from '/@/types/quotation';

/** entry 是父组件传入的当前编辑对象；locked 控制只读，extra 区分独立安装项，status/reason 展示上次计算结果。 */
const props = defineProps<{
	entry: InstallationEntry;
	options: InstallationOptions;
	rowCategory?: string;
	rowName?: string;
	rowSpec?: string;
	rowUnit?: string;
	customInstallation?: boolean;
	catalog?: InstallationCatalogBody;
	locked: boolean;
	extra?: boolean;
	status?: string;
	reason?: string;
}>();

/** 省区名称统一后按类别筛选安装指标项目，显式选择的项目保留并提示类别不匹配，避免自动套用相近项目。 */
const region = computed(() => props.options.region.replace(/省$/, '').replace(/壮族自治区$/, ''));
const editorCategory = computed(() => (props.rowCategory || props.entry.category || '').trim());
const editorKind = computed(() => {
	if (!editorCategory.value || editorCategory.value === '待识别') return '';
	if (editorCategory.value === '风管') return 'duct';
	if (editorCategory.value === '防火包裹') return 'wrap';
	return 'equipment';
});
const editorKindLabel = computed(() => ({ duct: '风管产品', equipment: '设备产品', wrap: '防火包裹' }[editorKind.value] || ''));
const nativeWrap = computed(
	() => !props.customInstallation && editorKind.value === 'wrap' && /玻璃棉|岩棉|硅酸钙板|硅酸盐板/.test(props.rowName || props.entry.name || '')
);
const wrapParts = computed(() => {
	const names = (props.rowName || props.entry.name || '')
		.replace(/(?:以及|及|和|与|带|加)(?=\s*(?:普通|排烟专用|铝箔)?(?:玻璃棉|岩棉|硅酸钙板|硅酸盐板))/g, '+')
		.split(/[+＋]/)
		.filter((part) => part.trim() && !/^(?:含|包含)?(?:安装|吊装|安装费|运费)$/.test(part.trim()));
	const specs = (props.rowSpec || '').split(/[+＋]/);
	return names.map((name, index) => {
		const text = name + ' ' + (names.length === 1 ? props.rowSpec || '' : names.length === specs.length ? specs[index] : '');
		const values = [...text.matchAll(/(?:厚(?:度)?\s*[:：=]?\s*|δ\s*[:：=]?\s*)(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:mm|毫米|厚)/gi)].map((m) =>
			Number(m[1] || m[2])
		);
		return { group: /硅酸钙板|硅酸盐板/.test(name) ? 'board' : /玻璃棉|岩棉/.test(name) ? 'glass' : '', thickness: [...new Set(values)] };
	});
});
const wrapGroups = computed(() => [...new Set(wrapParts.value.map((part) => part.group))]);
const projects = computed(() =>
	(props.catalog?.projects || []).filter((project) => {
		if (project.kind !== editorKind.value || !project.regions.includes(region.value)) return false;
		if (nativeWrap.value) return wrapGroups.value.length === 1 && project.id === `national_wrap_${wrapGroups.value[0]}`;
		return !project.id.startsWith('national_wrap_') || !/橡塑/.test(props.rowName || props.entry.name || '');
	})
);
const selectedProject = computed(() => props.catalog?.projects.find((project) => project.id === props.entry.project_id));
const projectKindMismatch = computed(
	() => !!selectedProject.value && !!editorKind.value && !projects.value.some((project) => project.id === selectedProject.value?.id)
);
const wrapAutomaticHint = computed(() => {
	if (!nativeWrap.value) return '';
	const cubic = /^(?:m³|m3|m\^3|立方米|立方|方)$/i.test(props.entry.unit || props.rowUnit || '㎡');
	let total = 0;
	for (const part of wrapParts.value) {
		const project = props.catalog?.projects.find((p) => p.id === `national_wrap_${part.group}`);
		if (!project || !part.group || (cubic && (part.thickness.length !== 1 || part.thickness[0] <= 0)))
			return '全国安装价按材料分别相加；立方报价需明确每项厚度。保存后统一试算确认。';
		total += Number(project.price) * (cubic ? 1000 / part.thickness[0] : 1);
	}
	return `全国安装销售价参考：${total.toFixed(1)}元/${
		cubic ? 'm³' : '㎡'
	}；组合逐项相加，立方按各自厚度换算。项目留空可自动计算，以重新试算结果为准。`;
});
const isDuctEditor = computed(() => editorKind.value === 'duct');
/** 结合产品名称、规格和安装项文本识别风机编辑场景；陕西分档风机显示需人工确认的功率字段。 */
const productText = computed(() =>
	[props.rowName, props.rowSpec, props.rowCategory, props.entry.name, props.entry.category].filter(Boolean).join(' ')
);
const isFanEditor = computed(() => /风机|通风机|HTF|HTFC|SWF|GXF|HL3|PYHL|SZF/i.test(productText.value));
const showFanPower = computed(
	() => editorKind.value === 'equipment' && region.value === '陕西' && (isFanEditor.value || !!selectedProject.value?.power_prices?.length)
);
/** 陕西风管需确认辅材类型；指标覆盖地区以外若含辅材，则要求填写人工辅材单价。 */
const showShaanxiAuxiliary = computed(() => isDuctEditor.value && region.value === '陕西' && props.options.include_auxiliaries);
const showOtherAuxiliaryPrice = computed(
	() => isDuctEditor.value && !!region.value && props.options.include_auxiliaries && !['贵州', '四川', '云南', '广西', '陕西'].includes(region.value)
);
/** 选择项目之前先明确产品类别和整单安装省区；留空表示交由试算匹配，有歧义仍需人工选定。 */
const projectPlaceholder = computed(() => {
	if (!editorKind.value) return '请先确认产品品类';
	if (!region.value) return '请先选择项目所在省份';
	return '留空则试算时匹配；有歧义须人工选定';
});
/** 显示安装项目的未税销售单价或功率分档单价，帮助报价员核对选中的原表项目。 */
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
