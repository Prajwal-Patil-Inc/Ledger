/* Bottom-sheet modal plumbing shared by every dialog. */

export function showModal(html) {
  document.getElementById("modalBody").innerHTML = `<div class="modal-handle"></div>${html}`;
  document.getElementById("modalBackdrop").classList.add("open");
}

export function closeModal() {
  document.getElementById("modalBackdrop").classList.remove("open");
}

/** Make a segmented control (.seg) behave like a radio group. */
export function wireSeg(id) {
  const seg = document.getElementById(id);
  seg.querySelectorAll("button").forEach((b) => {
    b.onclick = () => {
      seg.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
    };
  });
}

export function segValue(id) {
  return document.querySelector(`#${id} button.active`).dataset.val;
}
