import Login from '../login/login';
import Viewer from '../viewer/viewer';

export default {
  $modal: $('.modal'),
  $overlay: $('.loading-overlay'),
  show() {
    this.$modal.addClass('show');
    this.$overlay.removeClass('invisible');
  },
  hide() {
    this.$modal.removeClass('show');
    this.$overlay.addClass('invisible');
  },
  init() {
  }
}
