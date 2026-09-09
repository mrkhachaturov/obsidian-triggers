/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { QuickAddChoice } from '../services/handlers/QuickAddHandler';

/** The choices another plugin publishes, for the picker. Empty when it is not installed. */
export interface IChoiceSource {
  choices(): readonly QuickAddChoice[];
}
