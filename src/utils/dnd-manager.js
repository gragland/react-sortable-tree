/** @typedef {import("react-dnd").DropTargetMonitor} DropTargetMonitor */

import {
  DndProvider,
  useDrop,
  useDrag,
} from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';
import React, { useRef } from 'react';
import { getDepth } from './tree-data-utils';
import { memoizedInsertNode } from './memoized-tree-data-utils';

export default class DndManager {
  constructor(treeRef) {
    this.treeRef = treeRef;
  }

  static wrapRoot(Comp) {
    return ((props) => (
      <DndProvider backend={HTML5Backend}>
        <Comp {...props} />
      </DndProvider>
    ));
  }

  get startDrag() {
    return this.treeRef.startDrag;
  }

  get dragHover() {
    return this.treeRef.dragHover;
  }

  get endDrag() {
    return this.treeRef.endDrag;
  }

  get drop() {
    return this.treeRef.drop;
  }

  get treeId() {
    return this.treeRef.treeId;
  }

  get dndType() {
    return this.treeRef.dndType;
  }

  get treeData() {
    return this.treeRef.state.draggingTreeData || this.treeRef.props.treeData;
  }

  get getNodeKey() {
    return this.treeRef.props.getNodeKey;
  }

  get customCanDrop() {
    return this.treeRef.props.canDrop;
  }

  get maxDepth() {
    return this.treeRef.props.maxDepth;
  }

  /**
   *
   * @param {*} dropTargetProps
   * @param {DropTargetMonitor} monitor
   * @param {HTMLDivElement} component
   */
  getTargetDepth(dropTargetProps, monitor, component) {
    let dropTargetDepth = 0;

    const rowAbove = dropTargetProps.getPrevRow();
    if (rowAbove) {
      let { path } = rowAbove;
      const aboveNodeCannotHaveChildren = !this.treeRef.canNodeHaveChildren(
        rowAbove.node
      );
      if (aboveNodeCannotHaveChildren) {
        path = path.slice(0, path.length - 1);
      }

      // Limit the length of the path to the deepest possible
      dropTargetDepth = Math.min(path.length, dropTargetProps.path.length);
    }

    let blocksOffset;
    let dragSourceInitialDepth = (monitor.getItem().path || []).length;

    // When adding node from external source
    if (monitor.getItem().treeId !== this.treeId) {
      // Ignore the tree depth of the source, if it had any to begin with
      dragSourceInitialDepth = 0;

      if (component) {
        const relativePosition = component.getBoundingClientRect(); // eslint-disable-line react/no-find-dom-node
        const leftShift =
          monitor.getSourceClientOffset().x - relativePosition.left;
        blocksOffset = Math.round(
          leftShift / dropTargetProps.scaffoldBlockPxWidth
        );
      } else {
        blocksOffset = dropTargetProps.path.length;
      }
    } else {
      // handle row direction support
      const direction = dropTargetProps.rowDirection === 'rtl' ? -1 : 1;

      blocksOffset = Math.round(
        (direction * monitor.getDifferenceFromInitialOffset().x) /
          dropTargetProps.scaffoldBlockPxWidth
      );
    }

    let targetDepth = Math.min(
      dropTargetDepth,
      Math.max(0, dragSourceInitialDepth + blocksOffset - 1)
    );

    // If a maxDepth is defined, constrain the target depth
    if (typeof this.maxDepth !== 'undefined' && this.maxDepth !== null) {
      const draggedNode = monitor.getItem().node;
      const draggedChildDepth = getDepth(draggedNode);

      targetDepth = Math.max(
        0,
        Math.min(targetDepth, this.maxDepth - draggedChildDepth - 1)
      );
    }

    return targetDepth;
  }

  /**
   *
   * @param {*} dropTargetProps
   * @param {DropTargetMonitor} monitor
   */
  canDrop(dropTargetProps, monitor) {
    if (!monitor.isOver()) {
      return false;
    }

    const rowAbove = dropTargetProps.getPrevRow();
    const abovePath = rowAbove ? rowAbove.path : [];
    const aboveNode = rowAbove ? rowAbove.node : {};
    const targetDepth = this.getTargetDepth(dropTargetProps, monitor, null);

    // Cannot drop if we're adding to the children of the row above and
    //  the row above is a function
    if (
      targetDepth >= abovePath.length &&
      typeof aboveNode.children === 'function'
    ) {
      return false;
    }

    if (typeof this.customCanDrop === 'function') {
      const { node } = monitor.getItem();
      const addedResult = memoizedInsertNode({
        treeData: this.treeData,
        newNode: node,
        depth: targetDepth,
        getNodeKey: this.getNodeKey,
        minimumTreeIndex: dropTargetProps.listIndex,
        expandParent: true,
      });

      return this.customCanDrop({
        node,
        prevPath: monitor.getItem().path,
        prevParent: monitor.getItem().parentNode,
        prevTreeIndex: monitor.getItem().treeIndex, // Equals -1 when dragged from external tree
        nextPath: addedResult.path,
        nextParent: addedResult.parentNode,
        nextTreeIndex: addedResult.treeIndex,
      });
    }

    return true;
  }

  wrapSource(Comp) {
    return ((props) => {
      const ref = useRef(null);
      const [collectedProps, connectDragSource, connectDragPreview] = useDrag({
        item: {type: this.dndType},
        begin: (monitor) => {
          this.startDrag(props);

          return {
            node: props.node,
            parentNode: props.parentNode,
            path: props.path,
            treeIndex: props.treeIndex,
            treeId: props.treeId,
          };
        },
        end: (item, monitor) => {
          this.endDrag(monitor.getDropResult());
        },
        isDragging: (monitor) => {
          const dropTargetNode = monitor.getItem().node;
          const draggedNode = props.node;

          return draggedNode === dropTargetNode;
        },
        collect: (monitor) => ({
          isDragging: monitor.isDragging(),
          didDrop: monitor.didDrop(),
        }),
      });
      return (
        <Comp ref={ref}
          {...props}
          {...collectedProps}
          connectDragSource={connectDragSource}
          connectDragPreview={connectDragPreview}
        />)
    });
  }

  wrapTarget(Comp) {
    return ((props) => {
      const ref = useRef(null);
      const [collectedProps, connectDropTarget] = useDrop({
        accept: this.dndType,
        drop: (item, monitor) => {
          const result = {
            node: item.node,
            path: item.path,
            treeIndex: item.treeIndex,
            treeId: this.treeId,
            minimumTreeIndex: props.treeIndex,
            depth: this.getTargetDepth(props, monitor, ref.current),
          };

          this.drop(result);

          return result;
        },
        hover: (item, monitor) => {
          const targetDepth = this.getTargetDepth(
            props,
            monitor,
            ref.current,
          );
          const draggedNode = item.node;
          const needsRedraw =
            // Redraw if hovered above different nodes
            (props.node !== draggedNode )||
            // Or hovered above the same node but at a different depth
            (targetDepth !== (props.path.length - 1));

          if (!needsRedraw) {
            return;
          }

          this.dragHover({
            node: draggedNode,
            path: item.path,
            minimumTreeIndex: props.listIndex,
            depth: targetDepth,
          });
        },
        canDrop: (item, monitor) => this.canDrop(props, monitor),
        collect: (monitor) => {
          const dragged = monitor.getItem();
          return {
            isOver: monitor.isOver(),
            canDrop: monitor.canDrop(),
            draggedNode: dragged ? dragged.node : null,
          };
        }
      });
      return (
        <Comp ref={ref}
          {...props}
          {...collectedProps}
          connectDropTarget={connectDropTarget}
        />)
    });
  }

  wrapPlaceholder(Comp) {
    return ((props) => {
      const [collectedProps, connectDropTarget] = useDrop({
        accept: this.dndType,
        drop: (item, monitor) => {
          const { node, path, treeIndex } = item;
          const result = {
            node,
            path,
            treeIndex,
            treeId: this.treeId,
            minimumTreeIndex: 0,
            depth: 0,
          };

          this.drop(result);

          return result;
        },
        collect: (monitor) => {
          const dragged = monitor.getItem();
          return {
            isOver: monitor.isOver(),
            canDrop: monitor.canDrop(),
            draggedNode: dragged ? dragged.node : null,
          };
        }
      });
      return (<Comp {...props} {...collectedProps} connectDropTarget={connectDropTarget} />)
    });
  }
}
