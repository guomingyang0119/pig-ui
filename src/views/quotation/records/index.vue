<template>
	<main class="quotation-page">
		<!-- 报价记录入口复用 QuoteList，统一提供历史版本查找与状态操作；具体单据详情和文件下载在报价工作台处理。 -->
		<header class="q-header">
			<div>
				<h1>报价记录</h1>
				<p class="q-subtitle">查看版本、下载历史文件，或从已有报价创建修订版。</p>
			</div>
		</header>
		<QuoteList />
	</main>
</template>
<script setup lang="ts" name="QuotationRecords">
/** 报价记录入口复用 QuoteList，统一提供历史版本查找与状态操作；具体单据详情和文件下载在报价工作台处理。 */
import QuoteList from '/@/views/quotation/QuoteList.vue';
import '/@/views/quotation/quotation.scss';
</script>
