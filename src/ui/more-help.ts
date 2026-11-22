import { h } from './dom';

// A fuller beginner tutorial on another website. It opens in a new tab so the app stays open.
const MORE_HELP_URL = 'https://rubikscu.be/how-to-solve/';

export function moreHelpLink(): HTMLAnchorElement {
  return h('a', { class: 'link more-help', href: MORE_HELP_URL, target: '_blank', rel: 'noopener noreferrer' },
    'More help (another website)');
}
