import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LipTrainerComponent } from './lip-trainer.component';

describe('LipTrainerComponent', () => {
  let component: LipTrainerComponent;
  let fixture: ComponentFixture<LipTrainerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LipTrainerComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(LipTrainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
