// A chapter book for Learning to Fly, as a functional extension (ADR-0003): its own activity, on the core's settings,
// sync, event log, journey and rewards. The core knows only this manifest; everything else here is the module's own.
import type { ModuleManifest, ScreenProps } from '@wayfinder/web/host';
import { createElement } from 'react';
import { useModuleSettings } from '@wayfinder/web/host';
import type { StoryState } from './book';
import { StoryScreen } from './web/StoryScreen';
import { StoryPath, StoryPreview, StoryReport, StorySettingsPanel } from './web/views';
import './story.css';

function Screen(p: ScreenProps) {
  const own = useModuleSettings<StoryState>('story');
  return own ? createElement(StoryScreen, { ...p, own }) : null;
}

const story: ModuleManifest = {
  id: 'story', kind: 'function', title: 'Story', icon: '📚', memory: 'cloud', sessions: true,
  enabled: (own) => !!(own as StoryState).enabled,
  Screen, HomePath: StoryPath, SettingsPanel: StorySettingsPanel, Preview: StoryPreview, Report: StoryReport,
};
export default story;
