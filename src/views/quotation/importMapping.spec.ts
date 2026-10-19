/** 导入映射的回归检查：覆盖风管、设备、混合清单、上下文跳过和人工改列，确保表单分组与预览随映射变化。 */
import { strict as assert } from 'node:assert';
import { analyseSheet, mappingGroups, mappingWarnings } from './importMapping';
import type { ImportSheet } from '/@/types/quotation';

/** 构造从第 2 行开始的最小 Excel 工作表，保留来源行号，便于断言产品预览与上下文行的对应关系。 */
const makeSheet = (values: string[][]): ImportSheet => ({
	name: '清单',
	suggested_mapping: {},
	suggested_start_row: 2,
	rows: values.map((cells, i) => ({ number: i + 2, cells, issues: [] })),
});
const mapping = { name: 0, spec: 1, quantity: 2, unit: 3 };
/** 纯风管清单仅展示通用与风管参数，未匹配的补充字段默认收起。 */
const duct = analyseSheet(makeSheet([['镀锌共板风管', '1.2mm', '855', '㎡']]), 2, mapping);
assert.equal(duct.duct, 1);
assert.deepEqual(
	mappingGroups(duct, mapping, []).map((g) => g.key),
	['common', 'duct']
);
assert.equal(mappingGroups(duct, mapping, [])[0].fields.length, 5);
assert.equal(mappingGroups(duct, mapping, [])[1].fields.length, 0);
/** 名称含“风管”的止回阀仍属于设备；排气扇同样不能因名称识别而被遗漏。 */
const equipment = analyseSheet(
	makeSheet([
		['风管止回阀', '500*500', '2', '个'],
		['管道式排气扇', '0.06kW', '2', '台'],
	]),
	2,
	mapping
);
assert.equal(equipment.duct, 0);
assert.equal(equipment.equipment, 2);
assert.deepEqual(
	mappingGroups(equipment, mapping, []).map((g) => g.key),
	['common', 'equipment']
);
/** 混合清单的尺寸列进入共用分组，设备功率仍保留在设备组；展开所有字段后不能出现重复字段。 */
const mixed = analyseSheet(
	makeSheet([
		['风管', '1.2mm', '855', '㎡'],
		['风机', '7.5kW', '2', '台'],
	]),
	2,
	mapping
);
const groups = mappingGroups(mixed, { ...mapping, power: 4, width: 5 }, []);
assert.deepEqual(
	groups.map((g) => g.key),
	['common', 'duct', 'equipment']
);
assert.ok(groups[2].fields.some(([key]) => key === 'power'));
assert.ok(groups[0].fields.some(([key]) => key === 'width'));
const allKeys = mappingGroups(mixed, mapping, ['common', 'duct', 'equipment']).flatMap((g) => g.fields.map(([key]) => key));
assert.equal(new Set(allKeys).size, allKeys.length);
assert.equal(mappingWarnings(mapping).length, 0);
assert.equal(mappingWarnings({ name: 0 }).length, 2);
/** 楼层说明从产品预览中剔除，无法识别的真实产品继续保留为待识别，不能静默丢行。 */
const contextSheet = makeSheet([
	['3.5米层', '', '', ''],
	['未知产品', '', '', ''],
]);
contextSheet.auto_context_rows = [{ number: 2, kind: 'section', label: '3.5米层' }];
const context = analyseSheet(contextSheet, 2, mapping);
assert.equal(context.context, 1);
assert.equal(context.unknown, 1);
assert.equal(context.preview[0].name, '未知产品');
/** 人工交换名称和规格映射后，统计与预览必须即时使用新映射。 */
const revised = analyseSheet(makeSheet([['7.5kW', '风机', '2', '台']]), 2, { ...mapping, name: 1, spec: 0 });
assert.equal(revised.equipment, 1);
assert.equal(revised.preview[0].spec, '7.5kW');
/** 自动上下文仅适用于当时的列映射；改列后不能继续隐藏可能成为产品的来源行。 */
const remappedContextSheet = makeSheet([['3.5米层', '风机'], ['原说明', '消声器']]);
remappedContextSheet.auto_mapping = { name: 0 };
remappedContextSheet.auto_context_rows = [{ number: 2, kind: 'section', label: '3.5米层' }];
const remappedContext = analyseSheet(remappedContextSheet, 2, { name: 1 });
assert.equal(remappedContext.context, 0);
assert.equal(remappedContext.preview[0].number, 2);
assert.equal(remappedContext.preview[0].name, '风机');
assert.equal(remappedContext.contextMayDiffer, true);
