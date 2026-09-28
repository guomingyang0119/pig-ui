import { strict as assert } from 'node:assert';
import { analyseSheet, mappingGroups, mappingWarnings } from './importMapping';
import type { ImportSheet } from '/@/types/quotation';

const makeSheet = (values: string[][]): ImportSheet => ({
	name: '清单',
	suggested_mapping: {},
	suggested_start_row: 2,
	rows: values.map((cells, i) => ({ number: i + 2, cells, issues: [] })),
});
const mapping = { name: 0, spec: 1, quantity: 2, unit: 3 };
const duct = analyseSheet(makeSheet([['镀锌共板风管', '1.2mm', '855', '㎡']]), 2, mapping);
assert.equal(duct.duct, 1);
assert.deepEqual(
	mappingGroups(duct, mapping, []).map((g) => g.key),
	['common', 'duct']
);
assert.equal(mappingGroups(duct, mapping, [])[0].fields.length, 5);
assert.equal(mappingGroups(duct, mapping, [])[1].fields.length, 0);
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
const contextSheet = makeSheet([
	['3.5米层', '', '', ''],
	['未知产品', '', '', ''],
]);
contextSheet.auto_context_rows = [{ number: 2, kind: 'section', label: '3.5米层' }];
const context = analyseSheet(contextSheet, 2, mapping);
assert.equal(context.context, 1);
assert.equal(context.unknown, 1);
assert.equal(context.preview[0].name, '未知产品');
const revised = analyseSheet(makeSheet([['7.5kW', '风机', '2', '台']]), 2, { ...mapping, name: 1, spec: 0 });
assert.equal(revised.equipment, 1);
assert.equal(revised.preview[0].spec, '7.5kW');
