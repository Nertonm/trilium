import utils from "../services/utils.js";
import AttachmentActionsWidget from "./buttons/attachments_actions.js";
import BasicWidget from "./basic_widget.js";
import server from "../services/server.js";
import options from "../services/options.js";
import imageService from "../services/image.js";

const TPL = `
<div class="attachment-detail">
    <style>
        .attachment-detail-wrapper {
            margin-bottom: 20px;
        }
        
        .attachment-title-line {
            display: flex;
            align-items: baseline;
        }
        
        .attachment-details {
            margin-left: 10px;
        }
        
        .attachment-content pre {
            background: var(--accented-background-color);
            padding: 10px;
            margin-top: 10px;
            margin-bottom: 10px;
        }
        
        .attachment-detail-wrapper.list-view .attachment-content pre {
            max-height: 400px;
        }
        
        .attachment-content img {
            margin: 10px;
        }
        
        .attachment-detail-wrapper.list-view .attachment-content img {
            max-height: 300px; 
            max-width: 90%; 
            object-fit: contain;
        }
        
        .attachment-detail-wrapper.full-detail .attachment-content img {
            max-width: 90%; 
            object-fit: contain;
        }
        
        .attachment-detail-wrapper.scheduled-for-deletion .attachment-content img {
            filter: contrast(10%);
        }
    </style>

    <div class="attachment-detail-wrapper">
        <div class="attachment-title-line">
            <h4 class="attachment-title"></h4>                
            <div class="attachment-details"></div>
            <div style="flex: 1 1;"></div>
            <div class="attachment-actions-container"></div>
        </div>
        
        <div class="attachment-deletion-warning alert alert-info"></div>
        
        <div class="attachment-content"></div>
    </div>
</div>`;

export default class AttachmentDetailWidget extends BasicWidget {
    constructor(attachment) {
        super();

        this.contentSized();
        this.attachment = attachment;
        this.attachmentActionsWidget = new AttachmentActionsWidget(attachment);
        this.isFullDetail = true;
        this.child(this.attachmentActionsWidget);
    }

    doRender() {
        this.$widget = $(TPL);
        this.refresh();

        super.doRender();
    }

    refresh() {
        this.$widget.find('.attachment-detail-wrapper')
            .empty()
            .append(
                $(TPL)
                    .find('.attachment-detail-wrapper')
                    .html()
            );
        this.$wrapper = this.$widget.find('.attachment-detail-wrapper');
        this.$wrapper.addClass(this.isFullDetail ? "full-detail" : "list-view");

        if (!this.isFullDetail) {
            this.$wrapper.find('.attachment-title').append(
                $('<a href="javascript:">')
                    .attr("data-note-path", this.attachment.parentId)
                    .attr("data-view-mode", "attachments")
                    .attr("data-attachment-id", this.attachment.attachmentId)
                    .text(this.attachment.title)
            );
        } else {
            this.$wrapper.find('.attachment-title')
                .text(this.attachment.title);
        }

        const $deletionWarning = this.$wrapper.find('.attachment-deletion-warning');
        const {utcDateScheduledForErasureSince} = this.attachment;

        if (utcDateScheduledForErasureSince) {
            this.$wrapper.addClass("scheduled-for-deletion");

            const scheduledSinceTimestamp = utils.parseDate(utcDateScheduledForErasureSince)?.getTime();
            const intervalMs = options.getInt('eraseUnusedImageAttachmentsAfterSeconds') * 1000;
            const deletionTimestamp = scheduledSinceTimestamp + intervalMs;
            const willBeDeletedInMs = deletionTimestamp - Date.now();

            $deletionWarning.show();

            if (willBeDeletedInMs >= 60000) {
                $deletionWarning.text(`This attachment will be deleted in ${utils.formatTimeInterval(willBeDeletedInMs)}`);
            } else {
                $deletionWarning.text(`This attachment will be deleted soon`);
            }

            $deletionWarning.append(", because the image attachment is not used. To prevent deletion, add the image back into the note.");
        } else {
            this.$wrapper.removeClass("scheduled-for-deletion");
            $deletionWarning.hide();
        }

        this.$wrapper.find('.attachment-details')
            .text(`Role: ${this.attachment.role}, Size: ${utils.formatSize(this.attachment.contentLength)}`);
        this.$wrapper.find('.attachment-actions-container').append(this.attachmentActionsWidget.render());
        this.$wrapper.find('.attachment-content').append(this.renderContent());
    }

    renderContent() {
        if (this.attachment.content) {
            return $("<pre>").text(this.attachment.content);
        } else if (this.attachment.role === 'image') {
            return `<img src="api/attachments/${this.attachment.attachmentId}/image/${encodeURIComponent(this.attachment.title)}?${this.attachment.utcDateModified}">`;
        } else {
            return '';
        }
    }

    copyAttachmentReferenceToClipboard() {
        imageService.copyImageReferenceToClipboard(this.$wrapper.find('.attachment-content'));
    }

    async entitiesReloadedEvent({loadResults}) {
        const attachmentChange = loadResults.getAttachments().find(att => att.attachmentId === this.attachment.attachmentId);

        if (attachmentChange) {
            if (attachmentChange.isDeleted) {
                this.toggleInt(false);
            } else {
                this.attachment = await server.get(`attachments/${this.attachment.attachmentId}?includeContent=true`);

                this.refresh();
            }
        }
    }
}