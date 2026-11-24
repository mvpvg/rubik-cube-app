import './styles.css';
import { go, register, start } from './app/router';
import { expireIfOld } from './app/session';
import { homeScreen } from './app/home';
import { listenForInstall } from './app/install';
import { movesScreen } from './help/moves-screen';
import { learnScreen } from './learn/learn-screen';
import { practiceScreen } from './practice/practice-screen';
import { reviewScreen } from './review/net-editor';
import { scanScreen } from './scan/scan-screen';
import { solveScreen } from './solve/solve-screen';
import { warmUpSolver } from './solve/fast-solve';

register('home', homeScreen);
register('scan', scanScreen);
register('review', reviewScreen);
register('solve', solveScreen);
register('learn', learnScreen);
register('practice', practiceScreen);
register('moves', movesScreen);

listenForInstall();
warmUpSolver();
start();

// An installed app can come back from the background after days, so the 7-day limit is checked again here.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && expireIfOld() && /^#\/(scan|review|solve|learn)\b/.test(window.location.hash)) go('home');
});
