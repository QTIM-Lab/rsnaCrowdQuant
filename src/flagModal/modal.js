import Login from '../login/login';
import Viewer from '../viewer/viewer';

export default {
  maxLength: 200,
  $modal: $('.flag-modal'),
  $overlay: $('.loading-overlay'),
  $textArea: $('.flag-modal .input-holder textarea'),
  $charactersLeft: $('.flag-modal .input-holder .count-down .characters-left'),
  $cancelButton: $('.flag-modal .button-holder .logout'),
  $submitButton: $('.flag-modal .button-holder .next-case'),
  setCharactersLeft(text) {
    const characters = text.length;

    this.$charactersLeft.text(this.maxLength - characters);
  },
  show(currentComment = '') {
    this.$textArea.val(currentComment);
    this.setCharactersLeft(currentComment);
    this.$modal.addClass('show');
    this.$textArea.focus();
    this.$overlay.removeClass('invisible');
  },
  hide() {
    this.$modal.removeClass('show');
    this.$overlay.addClass('invisible');
  },
  init(doneCallback) {
    this.$textArea.on('keyup', () => {
      this.setCharactersLeft(this.$textArea.val());
    });

    this.$submitButton.on('click', () => {
      doneCallback(this.$textArea.val());
      this.hide();
    });

    this.$cancelButton.on('click', () => {
      this.hide();
    });
  }
}
