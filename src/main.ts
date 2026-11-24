import { bootstrapApplication } from '@angular/platform-browser';
import './app/core/firebase';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent).catch((err) => console.error(err));
