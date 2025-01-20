/**
 * Copyright (c) 2018-2022 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import {Color} from 'molstar/lib/mol-util/color';
import {StructureElement, StructureProperties, Structure, Bond} from 'molstar/lib/mol-model/structure';
import {Location} from 'molstar/lib/mol-model/location';
import type {ColorTheme, LocationColor} from 'molstar/lib/mol-theme/color';
import {ThemeDataContext} from 'molstar/lib/mol-theme/theme';
import {TableLegend, ScaleLegend} from 'molstar/lib/mol-util/legend';
import {ModelFormat} from 'molstar/lib/mol-model-formats/format';
import {ParamDefinition as PD} from 'molstar/lib/mol-util/param-definition';
import {getPaletteParams, getPalette} from 'molstar/lib/mol-util/color/palette';
import {clashScoreColorMap, badBonesColorMap, badAnglesColorMap} from "../panels/summaryPanel";


const DefaultList = 'many-distinct';
const DefaultColor = Color(0xFAFAFA);
const Description = 'Gives every chain a color based on its `label_entity_id` value.';

export const EntityIdColorThemeParams = {
    ...getPaletteParams({type: 'colors', colorList: DefaultList}),
};
export type EntityIdColorThemeParams = typeof EntityIdColorThemeParams

export function getEntityIdColorThemeParams(ctx: ThemeDataContext) {
    const params = PD.clone(EntityIdColorThemeParams);
    return params;
}

function key(entityId: string, sourceSerial: number) {
    return `${entityId}|${sourceSerial}`;
}

function getSourceSerialMap(structure: Structure) {
    const map = new WeakMap<ModelFormat, number>();
    let count = 0;
    for (let i = 0, il = structure.models.length; i < il; ++i) {
        const sd = structure.models[i].sourceData;
        if (!map.has(sd)) map.set(sd, count++);
    }
    return map;
}

function getEntityIdSerialMap(structure: Structure, sourceMap: WeakMap<ModelFormat, number>) {
    const map = new Map<string, number>();
    for (let i = 0, il = structure.models.length; i < il; ++i) {
        const sourceSerial = sourceMap.get(structure.models[i].sourceData) ?? -1;
        const {label_entity_id} = structure.models[i].atomicHierarchy.chains;
        for (let j = 0, jl = label_entity_id.rowCount; j < jl; ++j) {
            const k = key(label_entity_id.value(j), sourceSerial);
            if (!map.has(k)) map.set(k, map.size);
        }
        const {coarseHierarchy} = structure.models[i];
        if (coarseHierarchy.isDefined) {
            const {entity_id: spheres_entity_id} = coarseHierarchy.spheres;
            for (let j = 0, jl = spheres_entity_id.rowCount; j < jl; ++j) {
                const k = key(spheres_entity_id.value(j), sourceSerial);
                if (!map.has(k)) map.set(k, map.size);
            }
            const {entity_id: gaussians_entity_id} = coarseHierarchy.gaussians;
            for (let j = 0, jl = gaussians_entity_id.rowCount; j < jl; ++j) {
                const k = key(gaussians_entity_id.value(j), sourceSerial);
                if (!map.has(k)) map.set(k, map.size);
            }
        }
    }
    return map;
}

export function ClashScoreColorTheme(ctx: ThemeDataContext, props: PD.Values<EntityIdColorThemeParams>): ColorTheme<EntityIdColorThemeParams> {
    let color: LocationColor;
    let legend: ScaleLegend | TableLegend | undefined;

    if (ctx.structure) {
        const l = StructureElement.Location.create(ctx.structure.root);
        const sourceSerialMap = getSourceSerialMap(ctx.structure);
        const entityIdSerialMap = getEntityIdSerialMap(ctx.structure.root, sourceSerialMap);

        const labelTable = Array.from(entityIdSerialMap.keys());
        const valueLabel = (i: number) => labelTable[i];

        const palette = getPalette(entityIdSerialMap.size, props, {valueLabel});
        legend = palette.legend;

        color = (location: Location): Color => {
            if (StructureElement.Location.is(location)) {
                const atomIndex = StructureProperties.residue.label_seq_id(location); // Get the atom index directly
                console.error("ATOM INDEX" + atomIndex);
                const colorStr = clashScoreColorMap.get(atomIndex) ?? "0xFAFAFA"; // Map atom index to color
                return Color.fromHexString(colorStr.replace('#', '0X'));
            } else if (Bond.isLocation(location)) {
                l.unit = location.aUnit;
                l.element = location.aUnit.elements[location.aIndex];
                const atomId = StructureProperties.atom.id(l); // Get the atom index for the bond
                const colorStr = clashScoreColorMap.get(atomId) ?? "0xFAFAFA";
                return Color.fromHexString(colorStr.replace('#', '0X'));
            }
            return DefaultColor; // Fallback color
        }
    } else {
        color = () => DefaultColor;
    }

    return {
        factory: ClashScoreColorTheme,
        granularity: 'group',
        color,
        props,
        description: Description,
        legend
    };
}

export const ClashScoreThemeProvider: ColorTheme.Provider<EntityIdColorThemeParams, 'quality-clash-score'> = {
    name: 'quality-clash-score',
    label: 'Clash Score',
    category: "Color by quality",
    factory: ClashScoreColorTheme,
    getParams: getEntityIdColorThemeParams,
    defaultValues: PD.getDefaultValues(EntityIdColorThemeParams),
    isApplicable: (ctx: ThemeDataContext) => !!ctx.structure
};

export function BadBondsColorTheme(ctx: ThemeDataContext, props: PD.Values<EntityIdColorThemeParams>): ColorTheme<EntityIdColorThemeParams> {
    let color: LocationColor;
    let legend: ScaleLegend | TableLegend | undefined;

    if (ctx.structure) {
        const l = StructureElement.Location.create(ctx.structure.root);
        const sourceSerialMap = getSourceSerialMap(ctx.structure);
        const entityIdSerialMap = getEntityIdSerialMap(ctx.structure.root, sourceSerialMap);

        const labelTable = Array.from(entityIdSerialMap.keys());
        const valueLabel = (i: number) => labelTable[i];

        const palette = getPalette(entityIdSerialMap.size, props, {valueLabel});
        legend = palette.legend;

        color = (location: Location): Color => {
            if (StructureElement.Location.is(location)) {
                const atomIndex = StructureProperties.residue.label_seq_id(location); // Get the atom index directly
                const colorStr = badBonesColorMap.get(atomIndex) ?? "0xFAFAFA"; // Map atom index to color
                return Color.fromHexString(colorStr.replace('#', '0X'));
            } else if (Bond.isLocation(location)) {
                l.unit = location.aUnit;
                l.element = location.aUnit.elements[location.aIndex];
                const atomId = StructureProperties.atom.id(l); // Get the atom index for the he atom index for the bond
                const colorStr = badBonesColorMap.get(atomId) ?? "0xFAFAFA"; // Map atom index to color
                return Color.fromHexString(colorStr.replace('#', '0X'));
            }
            return DefaultColor; // Fallback color
        }
    } else {
        color = () => DefaultColor;
    }

    return {
        factory: BadBondsColorTheme,
        granularity: 'group',
        color,
        props,
        description: Description,
        legend
    };
}

export const BadBondsColorThemeProvider: ColorTheme.Provider<EntityIdColorThemeParams, 'quality-bad-bonds-score'> = {
    name: 'quality-bad-bonds-score',
    label: 'Bad Bonds Score',
    category: "Color by quality",
    factory: BadBondsColorTheme,
    getParams: getEntityIdColorThemeParams,
    defaultValues: PD.getDefaultValues(EntityIdColorThemeParams),
    isApplicable: (ctx: ThemeDataContext) => !!ctx.structure
};

export function BadAnglesColorTheme(ctx: ThemeDataContext, props: PD.Values<EntityIdColorThemeParams>): ColorTheme<EntityIdColorThemeParams> {
    let color: LocationColor;
    let legend: ScaleLegend | TableLegend | undefined;

    if (ctx.structure) {
        const l = StructureElement.Location.create(ctx.structure.root);
        const sourceSerialMap = getSourceSerialMap(ctx.structure);
        const entityIdSerialMap = getEntityIdSerialMap(ctx.structure.root, sourceSerialMap);

        const labelTable = Array.from(entityIdSerialMap.keys());
        const valueLabel = (i: number) => labelTable[i];

        const palette = getPalette(entityIdSerialMap.size, props, {valueLabel});
        legend = palette.legend;

        color = (location: Location): Color => {
            if (StructureElement.Location.is(location)) {
                const atomIndex = StructureProperties.residue.label_seq_id(location); // Get the atom index directly
                console.error("ATOM INDEX" + atomIndex);
                const colorStr = badAnglesColorMap.get(atomIndex) ?? "0xFAFAFA"; // Map atom index to color
                return Color.fromHexString(colorStr.replace('#', '0X'));
            } else if (Bond.isLocation(location)) {
                l.unit = location.aUnit;
                l.element = location.aUnit.elements[location.aIndex];
                const atomId = StructureProperties.atom.id(l); // Get the atom index for the bond
                const colorStr = badAnglesColorMap.get(atomId) ?? "0xFAFAFA";
                return Color.fromHexString(colorStr.replace('#', '0X'));
            }
            return DefaultColor; // Fallback color
        }
    } else {
        color = () => DefaultColor;
    }

    return {
        factory: BadAnglesColorTheme,
        granularity: 'group',
        color,
        props,
        description: Description,
        legend
    };
}

export const BadAnglesColorThemeProvider: ColorTheme.Provider<EntityIdColorThemeParams, 'quality-bad-angles-score'> = {
    name: 'quality-bad-angles-score',
    label: 'Bad Angles Score',
    category: "Color by quality",
    factory: BadAnglesColorTheme,
    getParams: getEntityIdColorThemeParams,
    defaultValues: PD.getDefaultValues(EntityIdColorThemeParams),
    isApplicable: (ctx: ThemeDataContext) => !!ctx.structure
};

export function FragmentColorTheme(ctx: ThemeDataContext, props: PD.Values<EntityIdColorThemeParams>): ColorTheme<EntityIdColorThemeParams> {
    let color: LocationColor;
    let legend: ScaleLegend | TableLegend | undefined;

    if (ctx.structure) {
        const l = StructureElement.Location.create(ctx.structure.root);
        const sourceSerialMap = getSourceSerialMap(ctx.structure);
        const entityIdSerialMap = getEntityIdSerialMap(ctx.structure.root, sourceSerialMap);

        const labelTable = Array.from(entityIdSerialMap.keys());
        const valueLabel = (i: number) => labelTable[i];

        const palette = getPalette(entityIdSerialMap.size, props, {valueLabel});
        legend = palette.legend;

        color = (location: Location): Color => {
            if (StructureElement.Location.is(location)) {
                const atomIndex = StructureProperties.residue.label_seq_id(location); // Get the atom index directly
                console.error("ATOM INDEX" + atomIndex);
                var colorStr = "0xFAFAFA";
                if(clashScoreColorMap.get(atomIndex)) {
                    colorStr = "#6fc2d3";
                }
                return Color.fromHexString(colorStr.replace('#', '0X'));
            } else if (Bond.isLocation(location)) {
                l.unit = location.aUnit;
                l.element = location.aUnit.elements[location.aIndex];
                var colorStr = "0xFAFAFA";
                const atomId = StructureProperties.atom.id(l); // Get the atom index for the bond
                if(clashScoreColorMap.get(atomId)) {
                    colorStr = "#6fc2d3";
                }
                return Color.fromHexString(colorStr.replace('#', '0X'));
            }
            return DefaultColor; // Fallback color
        }
    } else {
        color = () => DefaultColor;
    }

    return {
        factory: BadAnglesColorTheme,
        granularity: 'group',
        color,
        props,
        description: Description,
        legend
    };
}

export const FragmentColorThemeProvider: ColorTheme.Provider<EntityIdColorThemeParams, 'fragment-color'> = {
    name: 'fragment-color',
    label: 'Color by fragment',
    category: "Color by fragment",
    factory: FragmentColorTheme,
    getParams: getEntityIdColorThemeParams,
    defaultValues: PD.getDefaultValues(EntityIdColorThemeParams),
    isApplicable: (ctx: ThemeDataContext) => !!ctx.structure
};
