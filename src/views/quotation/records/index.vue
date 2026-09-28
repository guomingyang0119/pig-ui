<template>
	<main class="quotation-page">
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
import QuoteList from '/@/views/quotation/QuoteList.vue';
import '/@/views/quotation/quotation.scss';
</script>
