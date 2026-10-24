import { createApp } from 'vue';
import pinia from '/@/stores/index';
import App from './App.vue';
import router from './router';
import { directive } from '/@/directive';
import Components from '/@/components';
import { i18n } from '/@/i18n';
import { properties } from '/@/utils/globalProperties';
import { useThemeConfig } from '/@/stores/themeConfig';
import { applyPrimaryPalette } from '/@/utils/theme';

// 导入全局样式
import '/@/theme/tailwind.css';
import '/@/theme/index.scss';

const app = createApp(App);

// 全局自定方法挂载
properties(app);
// 全局自定义指令挂载
directive(app);

app
	.use(pinia) // pinia 存储
	.use(router) // 路由
	.use(Components) // 全局引入自定义的组件&第三方的组件
	.use(i18n); // 国际化

// 启动即写入品牌主色，避免首屏闪现 Element Plus 默认色
applyPrimaryPalette(useThemeConfig(pinia).themeConfig.primary);

app.mount('#app');
