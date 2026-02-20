import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule} from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { AppRoutingModule } from './app-routing.module';

// Angular Material
import { MatDialogModule } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';

// Components
import { AppComponent } from './app.component';
import { HomeComponent } from './home/home.component';
import { HeaderComponent } from './shared/header/header.component';
import { SignInComponent } from './sign-in/sign-in.component';
import { PronunciationComponent } from './pronunciation/pronunciation.component';
import { FooterComponent } from './footer/footer.component';
import { ButtonComponent } from './shared/button/button.component';
import { StaticChatComponent } from './staticchat/staticchat.component';
import { ChatLLMComponent } from './chatllm/chatllm.component';
import { FitTextDirective } from './chatllm/fit-text.directive';

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    PronunciationComponent,
    StaticChatComponent,
    ChatLLMComponent,
    FitTextDirective
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    CommonModule,
    MatDialogModule,
    MatSlideToggleModule,
    MatIconModule,
    MatCardModule,
    FooterComponent,
    HeaderComponent,
    ButtonComponent
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
