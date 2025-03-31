#!/bin/bash
sed -i 's/verticalMerge: VerticalMerge.RESTART/verticalMerge: VerticalMergeType.RESTART/g' server/utils/DocumentFormatter.ts