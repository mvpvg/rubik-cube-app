import './styles.css';
import { register, start } from './app/router';
import { homeScreen } from './app/home';
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

warmUpSolver();
start();
