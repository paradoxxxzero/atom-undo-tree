'use babel'
/* global atom */

// eslint-disable-next-line max-len
// eslint-disable-next-line import/no-extraneous-dependencies, import/no-unresolved
import { CompositeDisposable } from 'atom'

export default {
  subscriptions: null,
  TreeHistoryProvider: null,

  createTreeHistoryProviderMaybe(DefaultHistoryProvider) {
    if (this.TreeHistoryProvider) {
      return
    }

    class TreeHistoryProvider extends DefaultHistoryProvider {
      pushPatch(patch) {
        // If we will lose redo info
        if (this.redoStack.length) {
          let transaction
          // Getting transaction checkpoint (and removing for now)
          const checkpoint = this.undoStack.pop()

          // This should not happen
          if (checkpoint.constructor.name !== 'Checkpoint') {
            console.warn('[undo-tree] Not a checkpoint', checkpoint)
            return super.pushPatch(patch)
          }

          // We will add redo to undo and redo undo too
          // Pushing redo stack to undo
          this.undoStack.push(...[...this.redoStack].reverse())
          // Inverting redo stack and adding again to form a tree branch
          this.undoStack.push(...this.redoStack.map(redo => {
            switch (redo.constructor.name) {
              case 'Transaction':
                // Copy is necessary here
                transaction = new redo.constructor(
                  redo.markerSnapshotAfter,
                  redo.patch.invert(),
                  redo.markerSnapshotBefore,
                  redo.groupingInterval)
                // Prevent grouping
                transaction.timestamp = NaN
                return transaction
              case 'Patch':
                return redo.invert()
              default:
                // Should not happen either
                console.warn('[undo-tree] Ignoring', redo)
            }
          }).filter(e => !!e))

          // Restoring transaction checkpoint
          this.undoStack.push(checkpoint)
        }

        // Finally adding the patch and clearing redo stack
        super.pushPatch(patch)
      }
    }
    this.TreeHistoryProvider = TreeHistoryProvider
  },

  activate() {
    this.subscriptions = new CompositeDisposable()
    // Register command that toggles this view
    this.subscriptions.add(
      atom.workspace.observeTextEditors(editor => {
        const buffer = editor.getBuffer()
        // Seriously we need an easier way to access atom dependencies
        this.createTreeHistoryProviderMaybe(buffer.historyProvider.constructor)
        buffer.setHistoryProvider(new this.TreeHistoryProvider(buffer))
      })
    )
  },

  deactivate() {
    atom.workspace.getTextEditors().map(editor => {
      const buffer = editor.getBuffer()
      buffer.restoreDefaultHistoryProvider(buffer.getHistory())
    })
    this.subscriptions.dispose()
  },

  serialize() {
    return {}
  }
}
