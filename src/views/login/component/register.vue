<template>
	<!-- 注册页面标题 -->
	<div class="text-center mb-9">
		<h2 class="text-lg font-medium text-gray-900 dark:text-white">
			{{ $t('register.title') }}
		</h2>
	</div>

	<el-form size="large" class="login-content-form" :rules="dataRules" ref="dataFormRef" :model="state.ruleForm">
		<!-- 用户名 -->
		<el-form-item class="mb-6 login-animation1" prop="username">
			<el-input text :placeholder="$t('password.accountPlaceholder1')" v-model="state.ruleForm.username" clearable
				autocomplete="off" class="rounded-md h-11 bg-gray-50 dark:bg-slate-700 dark:text-slate-200">
				<template #prefix>
					<el-icon class="text-gray-400 el-input__icon dark:text-slate-400">
						<ele-User />
					</el-icon>
				</template>
			</el-input>
		</el-form-item>

		<!-- 密码 -->
		<el-form-item class="mb-6 login-animation2" prop="password">
			<strength-meter :placeholder="$t('password.accountPlaceholder2')" v-model="state.ruleForm.password"
				autocomplete="off" class="rounded-md h-11 bg-gray-50 dark:bg-slate-700 dark:text-slate-200"
				:maxLength="12" :minLength="10">
				<template #prefix>
					<el-icon class="text-gray-400 el-input__icon dark:text-slate-400">
						<ele-Unlock />
					</el-icon>
				</template>
			</strength-meter>
		</el-form-item>

		<!-- 确认密码 -->
		<el-form-item class="mb-6 login-animation3" prop="confirmPassword">
			<el-input type="password" show-password :placeholder="$t('register.confirmPasswordPlaceholder')"
				v-model="state.ruleForm.confirmPassword" autocomplete="new-password"
				class="rounded-md h-11 bg-gray-50 dark:bg-slate-700 dark:text-slate-200">
				<template #prefix>
					<el-icon class="text-gray-400 el-input__icon dark:text-slate-400">
						<ele-Unlock />
					</el-icon>
				</template>
			</el-input>
		</el-form-item>

		<!-- 同意条款 -->
		<el-form-item prop="checked" class="mb-6">
			<el-checkbox v-model="state.ruleForm.checked" class="text-sm">
				<span class="text-gray-500 dark:text-slate-400">{{ $t('password.readAccept') }}</span>
				<a href="#" class="mx-1 text-blue-600 dark:text-blue-400 hover:underline">{{
					$t('password.privacyPolicy') }}</a>
			</el-checkbox>
		</el-form-item>

		<!-- 注册按钮 -->
		<el-form-item class="login-animation4">
			<el-button type="primary"
				class="w-full h-11 rounded-md bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 font-medium text-base transition-all duration-200 hover:-translate-y-[1px] active:scale-[0.98]"
				v-waves @click="handleRegister" :loading="loading">
				<span class="font-semibold tracking-wide">{{ $t('password.registerBtnText') }}</span>
			</el-button>
		</el-form-item>

		<!-- 返回登录链接 -->
		<div class="flex items-center justify-center mt-3 text-sm font-medium">
			<a href="#" class="text-blue-600 cursor-pointer dark:text-blue-400 hover:underline"
				@click.prevent="emit('change', LoginTypeEnum.PASSWORD)">
				{{ $t('password.backToLogin') }}
			</a>
		</div>
	</el-form>
</template>

<script setup lang="ts" name="register">
import { registerUser, validateUsername } from '/@/api/admin/user';
import { LoginTypeEnum } from '/@/api/login';
import { useMessage } from '/@/hooks/message';
import { useI18n } from 'vue-i18n';
import type { FormInstance } from 'element-plus';
import { useSiteConfig } from '/@/stores/siteConfig';
import { createPasswordRuleValidator } from '/@/utils/passwordRule';

// 注册生命周期事件
const emit = defineEmits(['change']);

// 按需加载组件
const StrengthMeter = defineAsyncComponent(() => import('/@/components/StrengthMeter/index.vue'));

// 使用i18n
const { t } = useI18n();
const { siteConfig } = storeToRefs(useSiteConfig());

// 表单引用
const dataFormRef = ref<FormInstance>();

// 加载中状态
const loading = ref(false);

interface RuleForm {
	username: string;
	password: string;
	confirmPassword: string;
	checked: boolean;
}

// 组件内部状态
const state = reactive({
	ruleForm: {
		username: '', // 用户名
		password: '', // 密码
		confirmPassword: '', // 确认密码
		checked: false, // 是否同意条款
	} as RuleForm,
});

type ValidateCallback = (error?: string) => void;
type ValidateRule = {
	field: string;
	fullField: string;
};
const passwordRuleValidator = createPasswordRuleValidator(() => siteConfig.value.passwordRule, t);

// 表单验证规则
const dataRules = reactive({
	username: [
		{ required: true, message: t('register.usernameEmpty'), trigger: 'blur' },
		{
			min: 5,
			max: 20,
			message: t('register.usernameLength'),
			trigger: 'blur',
		},
		{
			validator: (rule: ValidateRule, value: string, callback: ValidateCallback) => {
				validateUsername(rule, value, callback, false, t);
			},
			trigger: 'blur',
		},
	],
	password: [
		{ required: true, message: t('register.passwordEmpty'), trigger: 'blur' },
		{ validator: passwordRuleValidator, trigger: 'blur' },
	],
	confirmPassword: [
		{ required: true, message: t('register.confirmPasswordPlaceholder'), trigger: 'blur' },
		{
			validator: (_rule: ValidateRule, value: string, callback: ValidateCallback) => {
				callback(value === state.ruleForm.password ? undefined : t('register.passwordMismatch'));
			},
			trigger: 'blur',
		},
	],
	checked: [
		{ required: true, message: t('register.termsRequired'), trigger: 'change' },
		{
			validator: (_rule: ValidateRule, value: boolean, callback: ValidateCallback) => {
				if (!value) {
					callback(t('register.termsRequired'));
				} else {
					callback();
				}
			},
			trigger: ['change', 'blur'],
		}
	],
});

/**
 * 处理注册事件
 * @description 包括表单验证、注册、成功后返回登录
 * @returns 注册是否成功
 */
const handleRegister = async () => {
	// 验证表单是否符合规则
	const valid = await dataFormRef.value?.validate().catch(() => false);
	if (!valid) {
		return false;
	}

	try {
		loading.value = true;
		await registerUser({ username: state.ruleForm.username, password: state.ruleForm.password });
		useMessage().success(t('register.registerSuccess'));
		emit('change', LoginTypeEnum.PASSWORD);
		return true;
	} catch (err: any) {
		useMessage().error(err?.msg || t('errors.networkError'));
		return false;
	} finally {
		loading.value = false;
	}
};

</script>
