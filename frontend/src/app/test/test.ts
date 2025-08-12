import { Component } from '@angular/core';

@Component({
  selector: 'test',
  templateUrl: './test.html'
})
export class Test {
  counter = 0;

  testClick() {
    this.counter++;
    fetch("http://127.0.0.1:8080/ping")
        .then(res => res.json()) 
        .then(data => console.log(data.message))
        .catch(err => console.error(err));
  }
}
